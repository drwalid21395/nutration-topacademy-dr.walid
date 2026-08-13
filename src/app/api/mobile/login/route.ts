import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { signMobileToken } from '@/lib/mobile-token';

/**
 * تسجيل دخول تطبيق الموبايل (الجسر).
 * يتحقق من البريد وكلمة المرور ويعيد توكن Bearer مدته 90 يومًا
 * يستخدمه التطبيق لإرسال بيانات الساعة إلى نقاط الاستقبال.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit('mobile-login', 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { email?: string; password?: string; deviceName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'active') {
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signMobileToken(user.id, user.role);

  await audit(user.id, 'mobile.login', 'User', user.id, { deviceName: body.deviceName ? String(body.deviceName) : undefined });

  return NextResponse.json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
