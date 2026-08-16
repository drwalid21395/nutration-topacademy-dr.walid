/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/connect/route.ts

وظيفة الملف:
واجهة API بحرف POST لبدء ربط جهاز/مزود الساعة الذكية:
- لو المزود مُكوَّن في البيئة (مثل Strava/Polar/Oura/Fitbit):
  نبني له رابط OAuth الرسمي ونعيده للمتصفح ليتوجه إليه المستخدم.
- لو الإدخال اليدوي (manual): ننشئ اتصالًا جاهزًا مباشرة.
- لو المزود غير مُفعّل: نرد «قريبًا» دون إنشاء ربط وهمي.

لماذا نحتاجه؟
هذا هو الجزء الأول من OAuth: قبل أن يوافق المستخدم يجب أن
يصل لصفحة المزود. هنا نجهّز الرابط وننشئ «اتصالًا قيد
الانتظار» ينتظر عودة الكود من نقطة الاسترجاع (callback).

متى يعمل؟
عند استقبال طلب POST إلى /api/wearables/connect.

من يستدعي هذا الملف؟
صفحة «ربط الساعات الذكية» — عند الضغط على زر ربط مزود.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- rateLimit + audit من lib/security.
- prisma من lib/prisma: جدول WearableConnection.
- encryptText من lib/crypto.
- getAdapter من lib/wearables/adapters (يبني رابط OAuth).
- getProviderMeta / isProviderConfigured من lib/wearables/providers.

ترتيب العمل:
1. غير مسجل → 401. طلبات كثيرة → 429.
2. نقرأ الطلب → 400 لو غير صالح.
3. اليدوي: نعيد الاتصال الموجود أو ننشئه → نجاح فوري.
4. لو اتصال OAuth قائم مكتمل → نعيده دون تكرار.
5. لو المزود غير مُكوَّن → رد «قريبًا» (متاح: false).
6. نبني رابط OAuth عبر adapter.connect.
7. لو غير مدعوم بلا رابط → رد «قريبًا».
8. ننشئ اتصالًا قيد الانتظار (status: pending).
9. نرجع الرابط ليتوجه إليه المتصفح.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب بالجداول.
import { prisma } from '@/lib/prisma';
// rateLimit: يمنع الإفراط في الطلبات. audit: يسجل العمليات.
// كلاهما من lib/security (محلي).
import { rateLimit, audit } from '@/lib/security';
// encryptText: دالة محلية من lib/crypto تشفّر أي قيمة حساسة
// قبل حفظها (لا نخزّن التوكنات نصًا صريحًا).
import { encryptText } from '@/lib/crypto';
// getAdapter: دالة محلية من lib/wearables/adapters تعيد
// «مُكيّف» المزود القادر على بناء رابط OAuth الرسمي.
import { getAdapter } from '@/lib/wearables/adapters';
// getProviderMeta: بيانات تعريف المزود (الاسم بالعربية...).
// isProviderConfigured: هل توجد بيانات اعتماده في البيئة؟
// كلاهما من lib/wearables/providers (محلي).
import { getProviderMeta, isProviderConfigured } from '@/lib/wearables/providers';

// ========================================
// 2. معالج بدء الربط (POST)
// ========================================

/**
 * ربط جهاز/مزود.
 * - للمزود المكوَّن في البيئة: نعيد رابط OAuth الرسمي للمتصفح.
 * - للإدخال اليدوي: ننشئ اتصالًا يدويًا مباشرًا.
 * - ما عدا ذلك: status = unsupported (قريبًا) — لا ننشئ ربطًا وهميًا.
 */
// POST: بدء عملية الربط — يقرر المسار الصحيح حسب نوع المزود.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع إرسال أكثر من 15 طلب ربط في الدقيقة.
  // 429: طلبات كثيرة (Rate Limit).
  if (!rateLimit(`wearable:${user.id}`, 15, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب.
  // provider: اسم المزود (مثل strava). deviceName: اسم الجهاز.
  // code: كود اختياري (يُستخدم في بعض السيناريوهات).
  let body: { provider?: string; deviceName?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: تحديد المزود (الافتراضي manual = إدخال يدوي).
  const provider = String(body.provider ?? 'manual');
  // meta: معلومات المزود (الاسم بالعربية...).
  const meta = getProviderMeta(provider);

  // الخطوة 5: الحالة اليدوية — اتصال دائم متاح بلا OAuth.
  if (provider === 'manual' || provider === 'mobile') {
    // لو يوجد اتصال سابق نعيده ولا نكرر الإنشاء.
    const existing = await prisma.wearableConnection.findFirst({ where: { userId: user.id, provider } });
    const conn =
      existing ??
      (await prisma.wearableConnection.create({
        data: {
          userId: user.id,
          provider,
          providerName: provider === 'mobile' ? 'تطبيق الموبايل (Health Connect)' : 'إدخال يدوي',
          status: 'connected', // جاهز فورًا — لا انتظار
          deviceName: provider === 'mobile' ? 'تطبيق توب أكاديمي (Health Connect)' : undefined,
          source: provider === 'mobile' ? 'device' : 'manual',
          consentAt: new Date(),
          scopes: JSON.stringify(['activity', 'workouts']),
        },
      }));
    // نسجل العملية ونرجع النجاح فورًا.
    await audit(user.id, 'wearable.connect', 'WearableConnection', conn.id, { provider });
    return NextResponse.json({ ok: true, connection: conn });
  }

  // الخطوة 6: اتصال OAuth قائم — نُنهيه لا نكرره.
  const existingOauth = await prisma.wearableConnection.findFirst({ where: { userId: user.id, provider } });
  if (existingOauth && existingOauth.status === 'connected') {
    // لو مكتمل بالفعل → نعيده دون رابط جديد (لا داعي لإعادة الموافقة).
    return NextResponse.json({ ok: true, connection: existingOauth, redirectUrl: null });
  }

  // الخطوة 7: لو المزود غير مُكوَّن في البيئة → «قريبًا».
  // لا ننشئ ربطًا وهميًا أبدًا — الصدق أهم.
  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { error: 'هذا المزود غير مفعّل بعد — سيصبح متاحًا قريبًا.', available: false },
      { status: 200 }
    );
  }

  // الخطوة 8: بناء رابط OAuth عبر مُكيّف المزود.
  // adapter.connect() يفحص بيانات الاعتماد ويبني الرابط الرسمي.
  const adapter = getAdapter(provider);
  const result = await adapter.connect();

  // الخطوة 9: لو المزود غير مدعوم بالمتصفح مباشرة
  // (مثل Apple Health عبر Aggregator) → رسالة «قريبًا».
  if (result.status === 'unsupported' || !result.url) {
    return NextResponse.json({ error: 'يتطلب هذا المزود مسار تطبيق/مجمّع صحي — يظهر قريبًا.', available: false }, { status: 200 });
  }

  // الخطوة 10: حفظ اتصال قيد الانتظار.
  // status: 'pending' — سيكمله مسار callback عند عودة المستخدم
  // من صفحة المزود حاملًا الكود. scopes: الصلاحيات المطلوبة.
  // accessToken: لو أُرسل code نخزّنه مشفّرًا مؤقتًا.
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
  // الخطوة 11: تسجيل العملية وإعادة الرابط للمتصفح.
  await audit(user.id, 'wearable.connect', 'WearableConnection', conn.id, { provider });
  return NextResponse.json({ ok: true, connection: conn, redirectUrl: result.url });
}
