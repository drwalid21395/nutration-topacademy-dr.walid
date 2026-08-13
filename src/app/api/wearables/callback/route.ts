import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptText } from '@/lib/crypto';
import { audit } from '@/lib/security';
import { getProviderEnv } from '@/lib/wearables/providers';

/**
 * نقطة استرجاع OAuth 2.0 — تُستدعى من المزود بعد موافقة المستخدم.
 * نتبادل الكود مع توكن فعلي عند توفر بيانات الاعتماد في البيئة.
 */
const TOKEN_URLS: Record<string, string> = {
  fitbit: 'https://api.fitbit.com/oauth2/token',
  garmin: 'https://connect.garmin.com/oauth2/token',
  huawei: 'https://oauth-login.cloud.huawei.com/oauth2/v2/token',
  honor: 'https://oauth-login.cloud.huawei.com/oauth2/v2/token',
  polar: 'https://polarremote.com/v2/oauth2/token',
  whoop: 'https://api-oauth.whoop.com/oauth/token',
  oura: 'https://api.ouraring.com/oauth/token',
  strava: 'https://www.strava.com/oauth/token',
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const userId = url.searchParams.get('state');

  const conn = await prisma.wearableConnection.findFirst({
    where: { provider, status: 'pending' },
    orderBy: { updatedAt: 'desc' },
  });

  if (error || !code) {
    if (conn) await prisma.wearableConnection.update({ where: { id: conn.id }, data: { status: 'error', lastSyncError: error ?? 'فشل التفويض' } });
    return NextResponse.redirect(new URL('/wearables?error=denied', url.origin));
  }
  if (!conn) {
    return NextResponse.redirect(new URL('/wearables?error=no-connection', url.origin));
  }
  if (!conn.userId) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }
  if (userId && userId !== conn.userId) {
    return NextResponse.redirect(new URL('/wearables?error=state', url.origin));
  }

  const env = getProviderEnv(provider);
  const clientId = env?.clientIdEnv ? (process.env[env.clientIdEnv] ?? '') : '';
  const clientSecret = env?.clientSecretEnv ? (process.env[env.clientSecretEnv] ?? '') : '';
  const tokenUrl = TOKEN_URLS[provider];

  let accessToken = code;
  let refreshToken: string | undefined;
  let expiresIn: number | undefined;

  if (tokenUrl && clientId) {
    try {
      const tokenHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: `${url.origin}/api/wearables/callback?provider=${provider}`,
      });
      if (clientSecret) tokenBody.set('client_secret', clientSecret);
      if (provider === 'fitbit') {
        // Fitbit يتطلب Basic Auth بدل client_secret في الجسم.
        tokenHeaders.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret ?? ''}`).toString('base64')}`;
      }
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: tokenBody,
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        expiresIn = tokenData.expires_in;
      } else {
        // فشل تبادل التوكن — لا نخزّن كودًا بلا قيمة.
        await prisma.wearableConnection.update({
          where: { id: conn.id },
          data: { status: 'error', lastSyncError: 'فشل تبادل التوكن — أعد الربط من جديد.' },
        });
        return NextResponse.redirect(new URL('/wearables?error=token', url.origin));
      }
    } catch {
      await prisma.wearableConnection.update({
        where: { id: conn.id },
        data: { status: 'error', lastSyncError: 'فشل تبادل التوكن — أعد الربط من جديد.' },
      });
      return NextResponse.redirect(new URL('/wearables?error=token', url.origin));
    }
  }

  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: {
      status: 'connected',
      accessToken: encryptText(accessToken),
      refreshToken: refreshToken ? encryptText(refreshToken) : undefined,
      tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      lastSyncError: null,
      consentAt: new Date(),
      lastSyncAt: new Date(),
    },
  });

  await audit(conn.userId, 'wearable.oauth.callback', 'WearableConnection', conn.id, { provider });
  return NextResponse.redirect(new URL('/wearables?connected=1', url.origin));
}
