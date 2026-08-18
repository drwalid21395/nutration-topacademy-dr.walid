import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SafetySettingsPage } from '@/components/safety/safety-settings';

export const metadata = { title: 'إعدادات السلامة' };

export default async function SafetySettingsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <SafetySettingsPage user={user} />;
}
