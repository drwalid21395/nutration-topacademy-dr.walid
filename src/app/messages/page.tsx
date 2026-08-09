import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { MessagesView } from '@/components/messages/messages-view';

export const metadata = { title: 'الرسائل' };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  return (
    <AppShell user={user}>
      <MessagesView myId={user.id} myRole={user.role} initialUserId={sp.userId} />
    </AppShell>
  );
}
