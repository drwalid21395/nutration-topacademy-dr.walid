import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { CompetitionMode } from '@/components/competition/competition-mode';

export const metadata = { title: 'وضع البطولة' };

export default async function CompetitionModePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });

  return (
    <AppShell user={user}>
      <CompetitionMode
        hasProfile={!!profile}
        isMinor={profile?.isMinor ?? false}
        profileName={profile?.fullName ?? null}
        nextCompetitionDate={profile?.nextCompetitionDate?.toISOString() ?? null}
      />
    </AppShell>
  );
}
