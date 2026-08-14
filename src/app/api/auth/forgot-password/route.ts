/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/auth/forgot-password/route.ts

وظيفة الملف:
واجهة API بحرف POST تبدأ عملية استعادة كلمة المرور:
تتأكد أن البريد مسجّل، وتُنشئ رمزًا مؤقتًا، وتخزّنه
في جدول User، ثم تعيد رابط إعادة التعيين.
(في بيئة التطوير يُرجَع الرابط مباشرة، وفي الإنتاج يُرسَل بريد.)

لماذا نحتاجه؟
صفحة "نسيت كلمة المرور" ترسل البريد هنا؛ لو كان الحساب
موجودًا يستطيع المستخدم استرداده عبر الرابط.

متى يعمل؟
عند استقبال طلب POST إلى /api/auth/forgot-password.

ترتيب التنفيذ (قصة الطلب):
1. هل أرسل طلبات كثيرة من نفس الـ IP؟ (rateLimit) → 429.
2. نقرأ البريد ونفحصه بـ zod (forgotSchema) → 422 لو غير صالح.
3. نبحث عن المستخدم — إن لم يوجد نرجع نجاحًا عامًا (لأسباب أمنية).
4. نُنشئ رمزًا عشوائيًا ونحفظه مع مدة صلاحيته (ساعة).
5. نركّب رابط إعادة التعيين ونرجعه (تطوير) أو نرسله بريدًا (إنتاج).

ماذا يعني HTTP Status؟
- 200: نجاح (بلا رسالة تكشف وجود الحساب).
- 400: بيانات غير صالحة. 422: بريد غير صالح.
- 429: محاولات كثيرة.

العلاقة مع الملفات:
- prisma من lib/prisma.
- forgotSchema من lib/validation (قاعدة فحص zod).
- rateLimit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// randomBytes: من مكتبة crypto (Node.js) — لإنشاء رمز عشوائي
// قوي وآمن لا يمكن تخمينه.
import { randomBytes } from 'crypto';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// forgotSchema: ملف محلي من lib/validation — قواعد التحقق من
// البريد المرسل عبر مكتبة zod.
import { forgotSchema } from '@/lib/validation';
// rateLimit: ملف محلي من lib/security — منع الطلبات الكثيرة.
import { rateLimit } from '@/lib/security';

// ========================================
// 2. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/auth/forgot-password.
// req: كائن الطلب الواصل (يحوي البريد الإلكتروني).
/**
 * استعادة كلمة المرور.
 * في بيئة التطوير يُرجَع رابط إعادة التعيين مباشرة في الاستجابة.
 * في الإنتاج يُرسَل بريد — ضع تكامل SMTP في sendResetEmail أدناه.
 */
export async function POST(req: NextRequest) {
  // الخطوة 1: منع المحاولات الكثيرة — 5 محاولات فقط كل 15 دقيقة لنفس الـ IP.
  // x-forwarded-for: عنوان IP القادم من بروكسي.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`forgot:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  // الخطوة 2: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: التحقق من صحة البريد عبر zod.
  // safeParse: يفحص البيانات ولا يرمي خطأً، بل يعيد نتيجة نجاح/فشل.
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'بريد إلكتروني غير صالح' }, { status: 422 });
  }

  // toLowerCase: نبحث بالبريد بأحرف صغيرة لتفادي تكرار الحسابات.
  const email = parsed.data.email.toLowerCase();
  // نبحث عن المستخدم في جدول User.
  const user = await prisma.user.findUnique({ where: { email } });

  // لا نكشف وجود الحساب من عدمه لأسباب أمنية
  // (حتى لا يستطيع أحد معرفة إن كان بريدٌ مسجّلًا أم لا).
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
    });
  }

  // الخطوة 4: إنشاء رمز إعادة التعيين.
  // randomBytes(32).toString('hex'): سلسلة عشوائية طويلة يصعب تخمينها.
  const token = randomBytes(32).toString('hex');
  // صلاحية الرمز: ساعة واحدة فقط من الآن.
  const expires = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

  // حفظ الرمز وتاريخ انتهائه في جدول User ليُستخدم لاحقًا.
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: expires },
  });

  // الخطوة 5: بناء رابط إعادة التعيين.
  // NEXTAUTH_URL: عنوان الموقع الأساسي من إعدادات البيئة.
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  // الرابط الكامل الذي سيضغطه المستخدم ويصل لصفحة إعادة التعيين.
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  // TODO(الإنتاج): أرسل البريد عبر SMTP (nodemailer/Resend) ثم احذف السطر التالي
  // في بيئة التطوير فقط نرجع الرابط مباشرة في الرد لتسهيل التجربة.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
      devResetUrl: resetUrl,
    });
  }

  // في الإنتاج نعيد رسالة عامة فقط (حفظًا لسرية الحساب).
  return NextResponse.json({
    ok: true,
    message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
  });
}
