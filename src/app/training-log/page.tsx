import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { DailyLog } from '@/components/logs/daily-log';

export const metadata = { title: 'سجل التمارين' };

export default async function TrainingLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true },
  });

  return (
    <AppShell user={user}>
      <DailyLog type="training" user={user} targets={targets} />
    </AppShell>
  );
}
