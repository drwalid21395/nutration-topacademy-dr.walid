import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { CoachDashboard } from '@/components/coach/coach-dashboard';

export const metadata = { title: 'لوحة المدرب' };

export default async function CoachDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!['coach', 'dietitian'].includes(user.role)) redirect('/dashboard');

  return (
    <AppShell user={user}>
      <CoachDashboard isDietitian={user.role === 'dietitian'} />
    </AppShell>
  );
}
