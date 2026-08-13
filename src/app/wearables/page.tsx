import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { WearablesPage } from '@/components/wearables/wearables-page';

export const metadata = { title: 'ربط الساعة الذكية' };

export default async function WearablesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <WearablesPage user={user} />;
}
