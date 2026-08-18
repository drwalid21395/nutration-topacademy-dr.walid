import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SafetyContactsPage } from '@/components/safety/safety-contacts';

export const metadata = { title: 'جهات اتصال الطوارئ' };

export default async function SafetyContactsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <SafetyContactsPage user={user} />;
}
