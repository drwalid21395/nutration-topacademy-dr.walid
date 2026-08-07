import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { forgotSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/security';

/**
 * استعادة كلمة المرور.
 * في بيئة التطوير يُرجَع رابط إعادة التعيين مباشرة في الاستجابة.
 * في الإنتاج يُرسَل بريد — ضع تكامل SMTP في sendResetEmail أدناه.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`forgot:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'بريد إلكتروني غير صالح' }, { status: 422 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // لا نكشف وجود الحساب من عدمه لأسباب أمنية
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
    });
  }

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: expires },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  // TODO(الإنتاج): أرسل البريد عبر SMTP (nodemailer/Resend) ثم احذف السطر التالي
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
      devResetUrl: resetUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    message: 'إن كان البريد مسجّلًا فستصلك رسالة إعادة التعيين',
  });
}
