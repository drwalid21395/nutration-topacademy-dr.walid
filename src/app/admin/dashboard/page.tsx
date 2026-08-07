import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export const metadata = { title: 'لوحة الإدارة' };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  return (
    <AppShell user={user}>
      <AdminDashboard />
    </AppShell>
  );
}
