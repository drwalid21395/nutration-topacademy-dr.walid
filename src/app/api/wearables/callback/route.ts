/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/callback/route.ts

وظيفة الملف:
واجهة API (نقطة استرجاع OAuth) بحرف GET تُستدعى من مزود
الساعة الذكية (Fitbit/Strava/Oura/Polar...) بعد موافقة
المستخدم على ربط حسابه. هنا نستلم «الكود» ونتحقق من كل شيء
ونتبادله مع توكن فعلي (accessToken/refreshToken) ثم نربط
الاتصال ونجعله جاهزًا للمزامنة.

لماذا نحتاجه؟
هذا هو الجزء الثاني من مفهوم OAuth: أولًا المتصفح يذهب
لصفحة المزود، وبعد الموافقة يعيد المزود المستخدم إلى هذا
الرابط ومعه رمز مؤقت (code) نستبدله بتوكن دائم نستخدمه
لجلب بيانات النشاط لاحقًا.

متى يعمل؟
عندما يعيد المزود المستخدم إلى:
/api/wearables/callback?provider=...&code=...&state=...

من يستدعي هذا الملف؟
لا تستدعيه صفحتنا — بل خدمة خارجية (Fitbit/Strava/Oura/
Polar...) بشكل تلقائي بعد موافقة المستخدم في صفحتها.

الملفات التي يتعامل معها:
- prisma من lib/prisma: جدول WearableConnection.
- encryptText من lib/crypto: تشفير التوكنات قبل حفظها.
- audit من lib/security: تسجيل العملية في سجل التدقيق.
- getProviderEnv من lib/wearables/providers: أسماء مفاتيح
  بيانات الاعتماد في البيئة.

ترتيب العمل:
1. نقرأ من الرابط: provider و code و error و userId (من state).
2. نبحث عن اتصال قيد الانتظار (status: pending) لهذا المزود.
3. لو error أو لا يوجد code → حالة error + إعادة توجيه بفشل.
4. لو لا يوجد اتصال → إعادة توجيه «لا يوجد اتصال».
5. لو الاتصال بلا مستخدم → إلى صفحة تسجيل الدخول.
6. لو state مختلفًا عن صاحب الاتصال → رفض (حماية من العبث).
7. نتبادل الكود مع توكن عبر طلب POST لخدمة المزود.
8. نشفّر التوكنين ونحفظهما في الاتصال (لا نُخزنهما نصًا).
9. نسجل العملية (audit) ونعيد التوجيه إلى لوحة الساعات بنجاح.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب بالجداول.
import { prisma } from '@/lib/prisma';
// encryptText: دالة محلية من lib/crypto تشفّر التوكنات
// (AES-256-GCM) حتى لا تُحفظ حساسة في قاعدة البيانات.
import { encryptText } from '@/lib/crypto';
// audit: دالة محلية من lib/security تسجل العملية في سجل التدقيق.
import { audit } from '@/lib/security';
// getProviderEnv: دالة محلية من lib/wearables/providers تعيد
// أسماء مفاتيح بيانات الاعتماد (client id/secret) في البيئة.
import { getProviderEnv } from '@/lib/wearables/providers';

// ========================================
// 2. عناوين تبادل التوكن لكل مزود
// ========================================

/**
 * نقطة استرجاع OAuth 2.0 — تُستدعى من المزود بعد موافقة المستخدم.
 * نتبادل الكود مع توكن فعلي عند توفر بيانات الاعتماد في البيئة.
 */
// TOKEN_URLS: قاموس يربط اسم كل مزود بعنوان خدمته الخاصة
// التي نستبدل عندها «الكود» بتوكن. Record<string, string>:
// مفاتيح وقيم نصوص. كل هذه عناوين HTTPS خارجية للخدمات نفسها.
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

// ========================================
// 3. معالج نقطة الاسترجاع (GET)
// ========================================

// GET: هذه الدالة لا يطلبها المستخدم مباشرة، بل المزود الخارجي.
// تعمل بعدة فحوص أمان ثم تخزّن التوكن وتعيد التوجيه للوحة.
export async function GET(req: NextRequest) {
  // الخطوة 1: استخراج معاملات الرابط.
  // provider: اسم المزود. code: الرمز المؤقت من المزود.
  // error: لو رفض المزود الموافقة. state: معرّف المستخدم الذي
  // أرسلناه عند بدء الربط (للتحقق من أن الطلب نفسه).
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const userId = url.searchParams.get('state');

  // الخطوة 2: البحث عن الاتصال قيد الانتظار لهذا المزود.
  // هو الذي أنشأناه في مسار /connect قبل ذهاب المستخدم للمزود.
  const conn = await prisma.wearableConnection.findFirst({
    where: { provider, status: 'pending' },
    orderBy: { updatedAt: 'desc' },
  });

  // الخطوة 3: لو المزود رفض (error) أو لم يعيد كودًا → نفشل الربط.
  if (error || !code) {
    // نحدّث حالة الاتصال إلى error مع سبب الفشل.
    if (conn) await prisma.wearableConnection.update({ where: { id: conn.id }, data: { status: 'error', lastSyncError: error ?? 'فشل التفويض' } });
    // إعادة توجيه المستخدم إلى لوحة الساعات مع رسالة فشل.
    return NextResponse.redirect(new URL('/wearables?error=denied', url.origin));
  }
  // الخطوة 4: لو لا يوجد اتصال قيد الانتظار → لا يمكن إكمال الربط.
  if (!conn) {
    return NextResponse.redirect(new URL('/wearables?error=no-connection', url.origin));
  }
  // الخطوة 5: لو الاتصال بلا مستخدم → نحيله لتسجيل الدخول.
  if (!conn.userId) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }
  // الخطوة 6: فحص أمني مهم — لو state مختلفًا عن صاحب الاتصال
  // فقد يكون الطلب مُزوَّرًا (CSRF) → نرفض.
  if (userId && userId !== conn.userId) {
    return NextResponse.redirect(new URL('/wearables?error=state', url.origin));
  }

  // الخطوة 7: تجهيز بيانات الاعتماد من البيئة.
  // نقرأ أسماء مفاتيح العميل من سجل المزود ثم قيمها من process.env
  // (لا تُكتب في الكود أبدًا — أسرار محفوظة في Vercel).
  const env = getProviderEnv(provider);
  const clientId = env?.clientIdEnv ? (process.env[env.clientIdEnv] ?? '') : '';
  const clientSecret = env?.clientSecretEnv ? (process.env[env.clientSecretEnv] ?? '') : '';
  const tokenUrl = TOKEN_URLS[provider];

  // الخطوة 8: نبدأ بالكود نفسه كتوكن مؤقت (للمزودات غير المكوَّنة)،
  // ثم نستبدله بتوكن حقيقي لو كانت بيانات الاعتماد متاحة.
  let accessToken = code;
  let refreshToken: string | undefined;
  let expiresIn: number | undefined;

  // الخطوة 9: تبادل الكود مع توكن فعلي (إن أمكن).
  if (tokenUrl && clientId) {
    try {
      // نرسل الكود بصيغة النماذج (form) كما تطلب المواصفة.
      const tokenHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code', // نوع العملية: استبدال كود
        client_id: clientId,
        code, // الكود الذي أعادنا المزود
        redirect_uri: `${url.origin}/api/wearables/callback?provider=${provider}`, // يجب تطابق ما سُجّل
      });
      // السر نُرسله في الجسم عادةً...
      if (clientSecret) tokenBody.set('client_secret', clientSecret);
      if (provider === 'fitbit') {
        // Fitbit يتطلب Basic Auth بدل client_secret في الجسم.
        tokenHeaders.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret ?? ''}`).toString('base64')}`;
      }
      // نرسل طلب POST إلى خدمة المزود للحصول على التوكن.
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: tokenBody,
      });
      // الرد يحوي access_token (لجلب البيانات) و refresh_token
      // (لتجديد التوكن بعد انتهائه) و expires_in (مدة الصلاحية).
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
      // أي خطأ شبكة أو خادم أثناء التبادل → فشل.
      await prisma.wearableConnection.update({
        where: { id: conn.id },
        data: { status: 'error', lastSyncError: 'فشل تبادل التوكن — أعد الربط من جديد.' },
      });
      return NextResponse.redirect(new URL('/wearables?error=token', url.origin));
    }
  }

  // الخطوة 10: حفظ التوكنات مشفّرة.
  // encryptText: التوكنات أسرار — نُخزّنها مشفرة فقط، ولا نطبعها.
  // tokenExpiresAt: وقت انتهاء صلاحية التوكن = الآن + مدة الصلاحية.
  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: {
      status: 'connected',
      accessToken: encryptText(accessToken),
      refreshToken: refreshToken ? encryptText(refreshToken) : undefined,
      tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      lastSyncError: null,
      consentAt: new Date(), // تاريخ موافقة المستخدم
      lastSyncAt: new Date(),
    },
  });

  // الخطوة 11: تسجيل العملية في سجل التدقيق ثم إعادة التوجيه للنجاح.
  await audit(conn.userId, 'wearable.oauth.callback', 'WearableConnection', conn.id, { provider });
  return NextResponse.redirect(new URL('/wearables?connected=1', url.origin));
}
