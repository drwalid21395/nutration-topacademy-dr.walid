import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * إدارة اشتراك الدفع للمتصفح:
 * POST { subscription: { endpoint, keys: { p256dh, auth } } } — تسجيل/تحديث الاشتراك
 * DELETE ?endpoint=<endpoint> — إلغاء الاشتراك
 */

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let input: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const sub = input?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'بيانات الاشتراك ناقصة' }, { status: 422 });
  }

  // إعادة الاستخدام: نفس النقطة تُستبدل لنفس المستخدم
  await prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
  await prisma.pushSubscription.create({
    data: {
      userId: me.id,
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'حدد نقطة الاشتراك' }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
  return NextResponse.json({ ok: true });
}
