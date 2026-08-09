import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type ActivityItem = {
  id: string;
  kind: 'notification' | 'message' | 'food' | 'training' | 'water' | 'analysis';
  swimmerId: string;
  swimmerName: string;
  swimmerImage: string | null;
  title: string;
  body: string;
  createdAt: string;
  link?: string;
};

/**
 * سجل النشاط الشامل للدكتور: كل الإشعارات والرسائل والوجبات والتمارين لكل السباحين.
 * مرتب تنازليًا حسب الأحدث.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  const [notifications, messages, foodLogs, trainingLogs, waterLogs, analyses] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        from: { select: { id: true, name: true, image: true, role: true } },
        to: { select: { id: true, name: true, image: true, role: true } },
      },
    }),
    prisma.foodLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.trainingLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.waterLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.mealAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const n of notifications) {
    if (n.user.role === 'admin' && n.userId === user.id) continue;
    items.push({
      id: `n-${n.id}`,
      kind: 'notification',
      swimmerId: n.userId,
      swimmerName: n.user.name ?? 'سباح',
      swimmerImage: n.user.image,
      title: `إشعار: ${n.title}`,
      body: n.body ?? '',
      createdAt: n.createdAt.toISOString(),
    });
  }

  for (const m of messages) {
    const from = m.fromId === user.id ? m.to : m.from;
    if (from.role === 'admin') continue;
    items.push({
      id: `m-${m.id}`,
      kind: 'message',
      swimmerId: from.id,
      swimmerName: from.name ?? 'سباح',
      swimmerImage: from.image,
      title: m.fromId === user.id ? `رسالة إلى ${from.name ?? 'السباح'}` : `رسالة من ${from.name ?? 'السباح'}`,
      body: m.body.slice(0, 120),
      createdAt: m.createdAt.toISOString(),
      link: '/messages',
    });
  }

  for (const f of foodLogs) {
    items.push({
      id: `f-${f.id}`,
      kind: 'food',
      swimmerId: f.userId,
      swimmerName: f.user.name ?? 'سباح',
      swimmerImage: f.user.image,
      title: 'وجبة مسجلة',
      body: `${f.foodName} — ${f.calories ?? 0} سعرة${f.proteinG ? ` · بروتين ${f.proteinG} جم` : ''}`,
      createdAt: f.createdAt.toISOString(),
      link: `/admin/swimmer/${f.userId}`,
    });
  }

  for (const t of trainingLogs) {
    const type = t.sessionType === 'gym' ? 'تمرين لياقة' : 'تمرين سباحة';
    items.push({
      id: `t-${t.id}`,
      kind: 'training',
      swimmerId: t.userId,
      swimmerName: t.user.name ?? 'سباح',
      swimmerImage: t.user.image,
      title: type,
      body: `${t.durationMin ?? 0} دقيقة${t.distanceM ? ` · ${t.distanceM} متر` : ''}${t.caloriesBurned ? ` · ${t.caloriesBurned} سعرة محروقة` : ''}`,
      createdAt: t.createdAt.toISOString(),
      link: `/admin/swimmer/${t.userId}`,
    });
  }

  for (const w of waterLogs) {
    items.push({
      id: `w-${w.id}`,
      kind: 'water',
      swimmerId: w.userId,
      swimmerName: w.user.name ?? 'سباح',
      swimmerImage: w.user.image,
      title: 'تسجيل ماء',
      body: `${w.amountMl} مل`,
      createdAt: w.createdAt.toISOString(),
      link: `/admin/swimmer/${w.userId}`,
    });
  }

  for (const a of analyses) {
    items.push({
      id: `a-${a.id}`,
      kind: 'analysis',
      swimmerId: a.userId,
      swimmerName: a.user.name ?? 'سباح',
      swimmerImage: a.user.image,
      title: 'تحليل وجبة بالذكاء الاصطناعي',
      body: `${a.totalCalories ?? 0} سعرة${a.confidence ? ` · ثقة ${Math.round(a.confidence)}٪` : ''}`,
      createdAt: a.createdAt.toISOString(),
      link: `/admin/swimmer/${a.userId}`,
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ items: items.slice(0, 100) });
}
