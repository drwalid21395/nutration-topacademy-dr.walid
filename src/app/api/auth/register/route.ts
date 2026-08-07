import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';
import { rateLimit, audit, sanitizeText } from '@/lib/security';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`register:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json(
      { error: 'هذا البريد مسجّل بالفعل، يمكنك تسجيل الدخول' },
      { status: 409 }
    );
  }

  // الأمان: منع إنشاء حساب مدير من التسجيل المفتوح
  const role = data.role === 'admin' ? 'athlete' : data.role;

  const passwordHash = await bcrypt.hash(data.password, 12);
  const isMinor = data.isAdult === false;

  const user = await prisma.user.create({
    data: {
      name: sanitizeText(data.name),
      email,
      phone: sanitizeText(data.phone ?? ''),
      passwordHash,
      role,
      isAdult: data.isAdult,
      parentalConsent: isMinor,
      parentName: sanitizeText(data.parentName ?? ''),
      parentPhone: sanitizeText(data.parentPhone ?? ''),
      acceptTerms: data.acceptTerms,
      acceptPrivacy: data.acceptPrivacy,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await audit(user.id, 'auth.register', 'User', user.id, { role: user.role });

  return NextResponse.json(
    { ok: true, message: 'تم إنشاء الحساب بنجاح', user },
    { status: 201 }
  );
}
