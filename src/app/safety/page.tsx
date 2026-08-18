import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SafetyDashboard } from '@/components/safety/safety-dashboard';

export const metadata = { title: 'مراقبة السلامة' };

export default async function SafetyRoute() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <SafetyDashboard user={user} />;
}
