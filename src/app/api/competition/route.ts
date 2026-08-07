import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const competition = await prisma.competition.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { startDate: 'desc' },
  });

  const plans = competition
    ? await prisma.mealPlan.findMany({
        where: {
          userId: user.id,
          planType: { in: ['competitionPrep', 'competitionDay', 'postCompetition'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, planType: true, title: true, totalCalories: true, proteinG: true },
      })
    : [];

  return NextResponse.json({ competition, plans });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`comp:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'أدخل ملف السباح أولًا' }, { status: 422 });

  let body: { name?: string; date?: string; location?: string; racesCount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.name || !body.date) {
    return NextResponse.json({ error: 'اسم البطولة وتاريخها مطلوبان' }, { status: 422 });
  }

  const startDate = new Date(body.date);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 422 });
  }

  await prisma.competition.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });

  const races: Record<string, unknown>[] = [];
  for (let i = 0; i < Math.min(body.racesCount ?? 1, 12); i++) {
    races.push({ number: i + 1, name: `سباق ${i + 1}`, time: null });
  }

  const competition = await prisma.competition.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      name: body.name,
      startDate,
      location: body.location || null,
      races: JSON.stringify(races),
    },
  });

  await audit(user.id, 'competition.create', 'Competition', competition.id, { name: body.name });

  return NextResponse.json({ ok: true, competition });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  await prisma.competition.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
