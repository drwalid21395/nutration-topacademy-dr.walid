/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/mobile/login/route.ts

وظيفة الملف:
واجهة API بحرف POST لتسجيل دخول تطبيق الموبايل (الجسر):
تتحقق من البريد وكلمة المرور، وتُحدّث وقت آخر دخول،
وتعيد توكن Bearer مدته 90 يومًا يستخدمه التطبيق لاحقًا.

لماذا نحتاجه؟
تطبيق الموبايل لا يستخدم صفحات الويب، فيحتاج نقطة دخول خاصة
يعيد فيها هذا الخادم توكنًا يحمله التطبيق مع كل طلب قادم
من الساعة الذكية (لإرسال بيانات الصحة).

متى يعمل؟
عند وصول طلب POST إلى /api/mobile/login
يحوي { email, password }.

ترتيب التنفيذ (قصة الطلب):
1. هل أرسل طلبات كثيرة؟ (rateLimit عام) → 429.
2. نقرأ البريد وكلمة المرور ونفحصهما.
3. نبحث عن المستخدم ونتحقق أنه نشط.
4. نقارن كلمة المرور المشفرة بـ bcrypt.
5. نحدّث وقت آخر دخول، ونوقّع توكن الموبايل (signMobileToken).
6. نسجل العملية (audit) ونرجع التوكن + بيانات المستخدم.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: بيانات دخول غير صحيحة. 422: بريد/كلمة مرور ناقصة.
- 429: طلبات كثيرة.

العلاقة مع الملفات:
- bcrypt من bcryptjs (مقارنة كلمة المرور المشفرة).
- prisma من lib/prisma.
- rateLimit + audit من lib/security.
- signMobileToken من lib/mobile-token (توقيع توكن الموبايل).
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// bcrypt: مكتبة خارجية لمقارنة كلمة المرور المدخلة مع
// تشفيرها المخزن في قاعدة البيانات (compare).
import bcrypt from 'bcryptjs';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';
// signMobileToken: ملف محلي من lib/mobile-token — ينشئ توكن
// موقّعًا خاصًا بتطبيق الموبايل (مدته 90 يومًا).
import { signMobileToken } from '@/lib/mobile-token';

// ========================================
// 2. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/mobile/login.
// req: كائن الطلب الواصل (يحوي البريد وكلمة المرور).
/**
 * تسجيل دخول تطبيق الموبايل (الجسر).
 * يتحقق من البريد وكلمة المرور ويعيد توكن Bearer مدته 90 يومًا
 * يستخدمه التطبيق لإرسال بيانات الساعة إلى نقاط الاستقبال.
 */
export async function POST(req: NextRequest) {
  // الخطوة 1: منع الطلبات الكثيرة — 20 محاولة في الدقيقة.
  // (مفتاح عام لا يخص مستخدمًا معيّنًا لعدم تسجيل الدخول بعد).
  if (!rateLimit('mobile-login', 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 2: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  let body: { email?: string; password?: string; deviceName?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: تنظيف البريد (trim يزيل المسافات، toLowerCase يوحد الأحرف).
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  // لو البريد أو كلمة المرور فارغان → 422.
  if (!email || !password) {
    return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 422 });
  }

  // الخطوة 4: البحث عن المستخدم في جدول User، والتأكد أن حسابه نشط.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'active') {
    // رسالة عامة "بيانات غير صحيحة" — لا نكشف أي جزء فشل لأسباب أمنية.
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  // الخطوة 5: مقارنة كلمة المرور المدخلة مع التشفير المخزن.
  // bcrypt.compare: تفك التشفير وتقارن بأمان.
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  // الخطوة 6: تحديث وقت آخر دخول، ثم توقيع التوكن الخاص بالموبايل.
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signMobileToken(user.id, user.role);

  // الخطوة 7: تسجيل العملية في سجل التدقيق مع اسم الجهاز إن وُجد.
  await audit(user.id, 'mobile.login', 'User', user.id, { deviceName: body.deviceName ? String(body.deviceName) : undefined });

  // الخطوة 8: إرجاع التوكن + معلومات المستخدم للتطبيق.
  return NextResponse.json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
