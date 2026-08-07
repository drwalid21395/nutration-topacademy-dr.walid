import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfToday } from '@/lib/utils';

/**
 * ظ‚ط§ط¦ظ…ط© ط§ظ„ط³ط¨ط§ط­ظٹظ† ظ…ط¹ ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ ط§ظ„ظٹظˆظ…ظٹ ظ„ظ„ط£ط¯ظ…ظ†.
 * ظƒظ„ ط³ط¨ط§ط­: ط¨ظٹط§ظ†ط§طھظ‡ + ط®ط·طھظ‡ ط§ظ„ظ†ط´ط·ط© + ظ…ط¬ظ…ظˆط¹ ظ…ط§ ط³ط¬ظ„ظ‡ ط§ظ„ظٹظˆظ… (ط³ط¹ط±ط§طھ/ط¨ط±ظˆطھظٹظ†/ظƒط±ط¨ظˆظ‡ظٹط¯ط±ط§طھ/ط¯ظ‡ظˆظ†/ظ…ط§ط،)
 * + ط¹ط¯ط¯ ط£ظٹط§ظ… ط§ظ„طھط³ط¬ظٹظ„ ظپظٹ ط¢ط®ط± 7 ط£ظٹط§ظ… + ظ†ط³ط¨ ط§ظ„ط§ظ„طھط²ط§ظ….
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ظ„ظٹط³طھ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط©' }, { status: 403 });

  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const swimmers = await prisma.user.findMany({
    where: { role: 'athlete', status: { not: 'deleted' } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      profiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { id: true, fullName: true, ageGroup: true, swimmerLevel: true, goal: true, weightKg: true },
      },
      mealPlans: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, title: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true, goal: true },
      },
      foodLogs: {
        where: { date: { gte: todayStart } },
        select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
      },
      waterLogs: {
        where: { date: { gte: todayStart } },
        select: { amountMl: true },
      },
    },
  });

  // ط£ظٹط§ظ… ط§ظ„طھط³ط¬ظٹظ„ ظپظٹ ط¢ط®ط± 7 ط£ظٹط§ظ… ظ„ظƒظ„ ط³ط¨ط§ط­
  const foodLogDays = await prisma.foodLogEntry.groupBy({
    by: ['userId', 'date'],
    where: { date: { gte: weekAgo }, userId: { in: swimmers.map((s) => s.id) } },
    _count: { _all: true },
  });
  const daysPerUser = new Map<string, Set<string>>();
  for (const row of foodLogDays) {
    const dayKey = row.date.toISOString().slice(0, 10);
    if (!daysPerUser.has(row.userId)) daysPerUser.set(row.userId, new Set());
    daysPerUser.get(row.userId)!.add(dayKey);
  }

  const rows = swimmers.map((s) => {
    const profile = s.profiles?.[0] ?? null;
    const plan = s.mealPlans[0] ?? null;

    const food = s.foodLogs.reduce<{ calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number }>(
      (acc, e) => ({
        calories: acc.calories + (e.calories ?? 0),
        proteinG: acc.proteinG + (e.proteinG ?? 0),
        carbsG: acc.carbsG + (e.carbsG ?? 0),
        fatG: acc.fatG + (e.fatG ?? 0),
        waterMl: acc.waterMl + (e.waterMl ?? 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, waterMl: 0 }
    );
    const waterMl = food.waterMl + s.waterLogs.reduce((a, w) => a + w.amountMl, 0);

    const pct = (value: number, target: number | null | undefined) =>
      target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null;

    return {
      id: s.id,
      name: s.name,
      fullName: profile?.fullName ?? s.name,
      email: s.email,
      image: s.image,
      status: s.status,
      createdAt: s.createdAt,
      lastLoginAt: s.lastLoginAt,
      profile: profile
        ? {
            ageGroup: profile.ageGroup ?? null,
            swimmerLevel: profile.swimmerLevel ?? null,
            goal: profile.goal ?? null,
            weightKg: profile.weightKg ?? null,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            title: plan.title,
            goal: plan.goal ?? null,
            calories: plan.totalCalories ?? null,
            proteinG: plan.proteinG ?? null,
            carbsG: plan.carbsG ?? null,
            fatG: plan.fatG ?? null,
            waterMl: plan.waterMl ?? null,
          }
        : null,
      today: {
        calories: Math.round(food.calories),
        proteinG: Math.round(food.proteinG),
        carbsG: Math.round(food.carbsG),
        fatG: Math.round(food.fatG),
        waterMl: Math.round(waterMl),
      },
      adherence: plan
        ? {
            calories: pct(food.calories, plan.totalCalories),
            protein: pct(food.proteinG, plan.proteinG),
            carbs: pct(food.carbsG, plan.carbsG),
            fat: pct(food.fatG, plan.fatG),
            water: pct(waterMl, plan.waterMl),
            overall: pct(
              food.calories,
              plan.totalCalories
            ),
          }
        : null,
      activeDays7: daysPerUser.get(s.id)?.size ?? 0,
    };
  });

  return NextResponse.json({ swimmers: rows });
}


