import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { Reports } from '@/components/reports/reports';

export const metadata = { title: 'التقارير' };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <AppShell user={user}>
      <Reports />
    </AppShell>
  );
}
