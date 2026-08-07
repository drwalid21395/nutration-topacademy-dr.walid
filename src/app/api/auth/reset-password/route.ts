import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetSchema } from '@/lib/validation';
import { rateLimit, audit } from '@/lib/security';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExp: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'رابط غير صالح أو منتهي الصلاحية' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExp: null,
    },
  });

  await audit(user.id, 'auth.resetPassword', 'User', user.id);

  return NextResponse.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
}
