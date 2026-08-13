import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { encryptText } from '@/lib/crypto';
import { getAdapter } from '@/lib/wearables/adapters';
import { getProviderMeta, isProviderConfigured } from '@/lib/wearables/providers';

/**
 * ربط جهاز/مزود.
 * - للمزود المكوَّن في البيئة: نعيد رابط OAuth الرسمي للمتصفح.
 * - للإدخال اليدوي: ننشئ اتصالًا يدويًا مباشرًا.
 * - ما عدا ذلك: status = unsupported (قريبًا) — لا ننشئ ربطًا وهميًا.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`wearable:${user.id}`, 15, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { provider?: string; deviceName?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const provider = String(body.provider ?? 'manual');
  const meta = getProviderMeta(provider);

  if (provider === 'manual') {
    const existing = await prisma.wearableConnection.findFirst({ where: { userId: user.id, provider: 'manual' } });
    const conn =
      existing ??
      (await prisma.wearableConnection.create({
        data: {
          userId: user.id,
          provider: 'manual',
          providerName: 'إدخال يدوي',
          status: 'connected',
          source: 'manual',
          consentAt: new Date(),
          scopes: JSON.stringify(['activity', 'workouts']),
        },
      }));
    await audit(user.id, 'wearable.connect', 'WearableConnection', conn.id, { provider: 'manual' });
    return NextResponse.json({ ok: true, connection: conn });
  }

  // اتصال OAuth قائم — نُنهيه لا نكرره.
  const existingOauth = await prisma.wearableConnection.findFirst({ where: { userId: user.id, provider } });
  if (existingOauth && existingOauth.status === 'connected') {
    return NextResponse.json({ ok: true, connection: existingOauth, redirectUrl: null });
  }

  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { error: 'هذا المزود غير مفعّل بعد — سيصبح متاحًا قريبًا.', available: false },
      { status: 200 }
    );
  }

  const adapter = getAdapter(provider);
  const result = await adapter.connect();

  if (result.status === 'unsupported' || !result.url) {
    return NextResponse.json({ error: 'يتطلب هذا المزود مسار تطبيق/مجمّع صحي — يظهر قريبًا.', available: false }, { status: 200 });
  }

  // حفظ اتصال قيد الانتظار مع تشفير لا قيمة له إلى حين وصول code من callback.
  const conn = await prisma.wearableConnection.create({
    data: {
      userId: user.id,
      provider,
      providerName: meta.nameAr,
      status: 'pending',
      deviceName: body.deviceName ? String(body.deviceName) : undefined,
      accessToken: body.code ? encryptText(String(body.code)) : undefined,
      consentAt: new Date(),
      scopes: JSON.stringify(['activity', 'workouts', 'sleep', 'weight']),
    },
  });
  await audit(user.id, 'wearable.connect', 'WearableConnection', conn.id, { provider });
  return NextResponse.json({ ok: true, connection: conn, redirectUrl: result.url });
}
