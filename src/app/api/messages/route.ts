import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit, sanitizeText } from '@/lib/security';
import { notifyUser } from '@/lib/push';

/**
 * الرسائل بين الدكتور والسباحين (محادثة ثنائية مفتوحة).
 * GET  ?with=<userId>  — عرض المحادثة وقراءة الرسائل الواردة
 * POST { toUserId, body } — إرسال رسالة (دكتور↔سباح فقط) مع إشعار داخلي ودفع للهاتف
 */

function canTalk(myRole: string, theirRole: string): boolean {
  const pair = [myRole, theirRole].sort().join('|');
  return pair === 'admin|athlete';
}

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const withId = url.searchParams.get('with');
  if (!withId) return NextResponse.json({ error: 'حدد المستخدم الآخر' }, { status: 400 });

  const other = await prisma.user.findUnique({
    where: { id: withId },
    select: { id: true, name: true, image: true, role: true, status: true },
  });
  if (!other || other.status === 'deleted') {
    return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
  }
  if (!canTalk(me.role, other.role)) {
    return NextResponse.json({ error: 'لا يمكن فتح هذه المحادثة' }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromId: me.id, toId: withId },
        { fromId: withId, toId: me.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      fromId: true,
      body: true,
      isRead: true,
      createdAt: true,
    },
  });

  // قراءة الرسائل الواردة
  await prisma.message.updateMany({
    where: { fromId: withId, toId: me.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({
    other: { id: other.id, name: other.name, image: other.image, role: other.role },
    messages,
  });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`messages:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { toUserId?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const toUserId = body.toUserId;
  const text = sanitizeText(body.body ?? '').trim();
  if (!toUserId) return NextResponse.json({ error: 'حدد المستلم' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'اكتب نص الرسالة' }, { status: 422 });
  if (text.length > 2000) return NextResponse.json({ error: 'الرسالة طويلة جدًا' }, { status: 422 });
  if (toUserId === me.id) return NextResponse.json({ error: 'لا يمكن إرسال رسالة لنفسك' }, { status: 422 });

  const to = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, role: true, status: true, name: true },
  });
  if (!to || to.status === 'deleted') return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
  if (!canTalk(me.role, to.role)) {
    return NextResponse.json({ error: 'الرسائل متاحة بين الدكتور والسباحين فقط' }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: { fromId: me.id, toId: toUserId, body: text },
    select: { id: true, fromId: true, body: true, isRead: true, createdAt: true },
  });

  await audit(me.id, 'message.send', 'Message', message.id, { to: toUserId });

  // إشعار داخل التطبيق + إشعار دفع على الهاتف للمستلم
  await notifyUser(toUserId, {
    type: 'message',
    title: `رسالة جديدة من ${me.name ?? 'الدكتور'}`,
    body: text.slice(0, 120),
    url: '/messages',
  });

  return NextResponse.json({ ok: true, message });
}
