/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/auth/reset-password/route.ts

وظيفة الملف:
واجهة API بحرف POST تُكمل عملية استعادة كلمة المرور:
تتحقق من الرمز المؤقت وصلاحيته، تشفّر كلمة المرور الجديدة
بشكل آمن (bcrypt)، وتحفظها في جدول User، ثم تلغي الرمز.

لماذا نحتاجه؟
عندما يضغط المستخدم رابط إعادة التعيين (القادم من forgot-password)
وتدخل صفحة إعادة التعيين، ترسل هذه الصفحة كلمة المرور الجديدة هنا.

متى يعمل؟
عند استقبال طلب POST إلى /api/auth/reset-password
يحوي { token, password }.

ترتيب التنفيذ (قصة الطلب):
1. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
2. نقرأ الرمز وكلمة المرور ونفحصهما بـ zod (resetSchema) → 422.
3. نبحث عن مستخدم برمز مطابق وغير منتهي الصلاحية.
4. لو الرمز غير صالح أو منتهي → 400.
5. نشفّر كلمة المرور بـ bcrypt ونحفظها ونحذف الرمز.
6. نسجل العملية (audit) ونرجع نجاحًا.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات/رمز غير صالح.
- 422: بيانات ناقصة أو غير صحيحة. 429: محاولات كثيرة.

العلاقة مع الملفات:
- bcrypt من bcryptjs (تشفير كلمة المرور).
- prisma من lib/prisma.
- resetSchema من lib/validation (قاعدة فحص zod).
- rateLimit + audit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// bcrypt: مكتبة خارجية لتشفير كلمة المرور بطريقة آمنة
// (hash) بحيث لا تُخزَّن كلمة المرور نصًا صريحًا في قاعدة البيانات.
import bcrypt from 'bcryptjs';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// resetSchema: ملف محلي من lib/validation — قواعد التحقق من
// الرمز وكلمة المرور المرسلة عبر مكتبة zod.
import { resetSchema } from '@/lib/validation';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/auth/reset-password.
// req: كائن الطلب الواصل (يحوي الرمز وكلمة المرور).
export async function POST(req: NextRequest) {
  // الخطوة 1: منع المحاولات الكثيرة — 10 محاولات كل 15 دقيقة لنفس الـ IP.
  // x-forwarded-for: عنوان IP القادم من بروكسي.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60_000)) {
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

  // الخطوة 3: التحقق من صحة البيانات عبر zod.
  // safeParse: يفحص البيانات ولا يرمي خطأً بل يعيد نتيجة.
  // errors[0]?.message: أول رسالة خطأ من قاعدة التحقق.
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }

  // الخطوة 4: البحث عن المستخدم الذي يحمل هذا الرمز.
  // findFirst: أول سجل يطابق الشرطين معًا:
  // 1) resetToken يساوي الرمز المرسل.
  // 2) resetTokenExp أكبر من الآن (الرمز لم ينتهِ بعد).
  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExp: { gt: new Date() },
    },
  });

  // لو لا يوجد مستخدم مطابق → الرمز غير صالح أو منتهي → 400.
  if (!user) {
    return NextResponse.json(
      { error: 'رابط غير صالح أو منتهي الصلاحية' },
      { status: 400 }
    );
  }

  // الخطوة 5: تشفير كلمة المرور الجديدة.
  // bcrypt.hash(..., 12): التشفير بمعامل قوة 12 — آمن وأبطأ عمدًا
  // لصعوبة كسر كلمات المرور المخزنة.
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  // تحديث المستخدم: حفظ التشفير الجديد + مسح الرمز لئلا يُعاد استخدامه.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExp: null,
    },
  });

  // الخطوة 6: تسجيل العملية في سجل التدقيق.
  await audit(user.id, 'auth.resetPassword', 'User', user.id);

  return NextResponse.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
