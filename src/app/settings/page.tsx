import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { NotificationPrefs } from '@/components/settings/notification-prefs';
import { Card, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { ROLES } from '@/lib/constants';

export const metadata = { title: 'الإعدادات' };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">الإعدادات</h1>
        <p className="mt-1 text-sm text-slate-500">إعدادات الإشعارات وتفضيلات الحساب.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <NotificationPrefs />
        </div>
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">معلومات الحساب</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">الاسم</span>
                <span className="font-bold text-slate-800">{dbUser?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">البريد</span>
                <span className="font-bold text-slate-800">{dbUser?.email ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">الدور</span>
                <Badge color="ocean">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">آخر دخول</span>
                <span className="font-bold text-slate-800">{dbUser?.lastLoginAt ? formatDate(dbUser.lastLoginAt) : '—'}</span>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-bold text-ocean-900">ملاحظة PWA</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              لتلقي إشعارات Push، ثبّت التطبيق من المتصفح (رمز التثبيت في شريط العنوان) وفعّل الإشعارات في إعدادات التطبيق والمتصفح.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
