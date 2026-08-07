import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get('days') ?? 7), 90);
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const [profile, targets, food, water, training, recovery, weight, plan] = await Promise.all([
    prisma.swimmerProfile.findFirst({ where: { userId: user.id } }),
    prisma.nutritionTargets.findFirst({ where: { profile: { userId: user.id } }, orderBy: { createdAt: 'desc' } }),
    prisma.foodLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.waterLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.trainingLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.recoveryLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.weightLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.mealPlan.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const sum = (arr: any[], k: string) => arr.reduce((a, i) => a + (Number(i[k]) || 0), 0);

  const avgSleep = recovery.length ? recovery.reduce((a, i) => a + (Number(i.sleepHours) || 0), 0) / recovery.length : 0;

  const dailyCalories: { date: string; consumed: number; target: number }[] = [];
  const byDate = new Map<string, { consumed: number }>();
  for (const f of food) {
    const key = new Date(f.date).toISOString().slice(0, 10);
    byDate.set(key, { consumed: (byDate.get(key)?.consumed ?? 0) + (Number(f.calories) || 0) });
  }
  for (let d = 0; d < days; d++) {
    const day = new Date(from);
    day.setDate(from.getDate() + d);
    const key = day.toISOString().slice(0, 10);
    dailyCalories.push({
      date: key,
      consumed: byDate.get(key)?.consumed ?? 0,
      target: Math.round(targets?.calories ?? 0),
    });
  }

  const adherenceDays = dailyCalories.filter((d) => d.target > 0 && Math.abs(d.consumed - d.target) / d.target <= 0.15).length;
  const adherencePct = days > 0 ? Math.round((adherenceDays / days) * 100) : 0;

  const weightFirst = weight[0]?.weightKg ?? null;
  const weightLast = weight[weight.length - 1]?.weightKg ?? null;
  const weightChange = weightFirst != null && weightLast != null ? Math.round((weightLast - weightFirst) * 10) / 10 : null;

  return NextResponse.json({
    days,
    profile,
    targets,
    totals: {
      calories: Math.round(sum(food, 'calories')),
      protein: Math.round(sum(food, 'proteinG')),
      carbs: Math.round(sum(food, 'carbsG')),
      fat: Math.round(sum(food, 'fatG')),
      water: Math.round(sum(water, 'amountMl')),
      sessions: training.length,
      swimMinutes: training.filter((t) => t.sessionType === 'swim').reduce((a, i) => a + (Number(i.durationMin) || 0), 0),
      gymMinutes: training.filter((t) => t.sessionType === 'gym').reduce((a, i) => a + (Number(i.durationMin) || 0), 0),
      avgSleep: Math.round(avgSleep * 10) / 10,
      weightChange,
      weightFirst,
      weightLast,
    },
    dailyCalories,
    adherencePct,
    plan: plan ? { id: plan.id, title: plan.title, totalCalories: plan.totalCalories } : null,
  });
}
