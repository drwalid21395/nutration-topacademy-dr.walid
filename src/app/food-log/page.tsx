import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { DailyLog, type LogType } from '@/components/logs/daily-log';

export const metadata = { title: 'سجل الطعام' };

export default async function FoodLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
  });

  return (
    <AppShell user={user}>
      <DailyLog type="food" user={user} targets={targets} />
    </AppShell>
  );
}
