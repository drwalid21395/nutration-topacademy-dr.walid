import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPlanFromTargets } from '@/services/plan/service';
import { rateLimit, audit } from '@/lib/security';

const PLAN_DURATIONS: Record<string, number> = {
  daily: 1,
  threeDays: 3,
  week: 7,
  twoWeeks: 14,
  thirtyDays: 30,
  competitionPrep: 7,
  competitionDay: 1,
  postCompetition: 3,
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`plan:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { targetsId?: string; planType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const planType = body.planType ?? 'week';
  const durationDays = PLAN_DURATIONS[planType] ?? 7;

  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'أدخل ملف السباح أولًا' }, { status: 422 });

  let targetsId = body.targetsId;
  if (!targetsId) {
    const last = await prisma.nutritionTargets.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) return NextResponse.json({ error: 'احسب الاحتياجات أولًا' }, { status: 422 });
    targetsId = last.id;
  }

  try {
    const { planId } = await createPlanFromTargets({
      userId: user.id,
      profileId: profile.id,
      targetsId,
      durationDays,
      planType,
      goal: profile.goal ?? undefined,
      isCompetition: planType === 'competitionPrep' || planType === 'competitionDay',
    });

    await audit(user.id, 'plan.create', 'MealPlan', planId, { planType, durationDays });

    return NextResponse.json({ ok: true, planId, message: 'تم إنشاء الخطة الغذائية بنجاح' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر إنشاء الخطة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
