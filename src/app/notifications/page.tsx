import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { NotificationsList } from '@/components/notifications/notifications-list';

export const metadata = { title: 'الإشعارات' };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <AppShell user={user}>
      <NotificationsList />
    </AppShell>
  );
}
