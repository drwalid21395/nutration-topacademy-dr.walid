import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const items = await prisma.notification.findMany({
    where: { userId: user.id, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false, isDismissed: false } });

  return NextResponse.json({ items, unread });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: { ids?: string[]; all?: boolean; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const where = { userId: user.id };

  if (body.all) {
    if (body.action === 'dismiss') {
      await prisma.notification.updateMany({ where, data: { isDismissed: true } });
    } else {
      await prisma.notification.updateMany({ where, data: { isRead: true } });
    }
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length) {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: body.action === 'dismiss' ? { isDismissed: true } : { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'لا يوجد معرّف' }, { status: 400 });
}
