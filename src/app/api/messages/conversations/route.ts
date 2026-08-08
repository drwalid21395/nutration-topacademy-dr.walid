import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * قائمة المحادثات:
 * - الدكتور: كل السباحين النشطين + آخر رسالة + عدد غير المقروء
 * - السباح: محادثة واحدة مع الدكتور
 */

type ConvEntry = {
  id: string;
  name: string | null;
  image: string | null;
  fullName: string | null;
  role: string;
  lastMessage: { id: string; body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
};

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (me.role === 'admin') {
    const athletes = await prisma.user.findMany({
      where: { role: 'athlete', status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        image: true,
        profiles: { select: { fullName: true }, take: 1 },
      },
    });

    const unreadRows = await prisma.message.groupBy({
      by: ['fromId'],
      where: { toId: me.id, isRead: false },
      _count: { _all: true },
    });
    const unreadMap = new Map(unreadRows.map((r) => [r.fromId, r._count._all]));

    const conversations: ConvEntry[] = [];
    for (const a of athletes) {
      const last = await prisma.message.findFirst({
        where: {
          OR: [
            { fromId: me.id, toId: a.id },
            { fromId: a.id, toId: me.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, body: true, fromId: true, createdAt: true },
      });
      conversations.push({
        id: a.id,
        name: a.name,
        image: a.image,
        fullName: a.profiles[0]?.fullName ?? null,
        role: 'athlete',
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              fromMe: last.fromId === me.id,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unread: unreadMap.get(a.id) ?? 0,
      });
    }
    return NextResponse.json({ conversations });
  }

  // السباح: محادثة واحدة مع الدكتور
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, image: true, profiles: { select: { fullName: true }, take: 1 } },
  });
  if (!admin) return NextResponse.json({ conversations: [] });

  const last = await prisma.message.findFirst({
    where: {
      OR: [
        { fromId: me.id, toId: admin.id },
        { fromId: admin.id, toId: me.id },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, body: true, fromId: true, createdAt: true },
  });
  const unread = await prisma.message.count({
    where: { fromId: admin.id, toId: me.id, isRead: false },
  });

  return NextResponse.json({
    conversations: [
      {
        id: admin.id,
        name: admin.name,
        image: admin.image,
        fullName: admin.profiles[0]?.fullName ?? null,
        role: 'admin',
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              fromMe: last.fromId === me.id,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unread,
      },
    ],
  });
}
