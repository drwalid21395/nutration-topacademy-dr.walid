import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { DailyLog, type LogType } from '@/components/logs/daily-log';

export const metadata = { title: 'سجل الطعام' };

export default async function FoodLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [targets, activePlan] = await Promise.all([
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
    }),
    prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
    }),
  ]);

  // وجبات اليوم (نفس منهجية لوحة التحكم — اليوم 1)
  const todayMeals = activePlan?.meals?.filter((m) => m.dayNumber === 1) ?? [];

  return (
    <AppShell user={user}>
      <DailyLog type="food" user={user} targets={targets} todayMeals={todayMeals} />
    </AppShell>
  );
}
