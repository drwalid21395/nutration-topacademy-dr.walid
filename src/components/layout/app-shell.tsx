'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  ClipboardList,
  Calculator,
  Salad,
  Camera,
  Utensils,
  Droplets,
  Dumbbell,
  Moon,
  Trophy,
  Pill,
  FileText,
  Bell,
  MessageSquare,
  Settings,
  BookOpen,
  Users,
  ShieldCheck,
  UserCheck,
  LogOut,
  Watch,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/swimmer-profile', label: 'ملف السباح', icon: ClipboardList },
  { href: '/my-profile', label: 'ملخص بياناتي', icon: UserCheck },
  { href: '/calculator', label: 'حاسبة الاحتياجات', icon: Calculator },
  { href: '/my-plans', label: 'البرنامج الغذائي', icon: BookOpen },
  { href: '/plan/create', label: 'إنشاء خطة غذائية', icon: Salad },
  { href: '/meal-analyzer', label: 'محلل الوجبات', icon: Camera },
  { href: '/food-log', label: 'سجل الطعام', icon: Utensils },
  { href: '/water-log', label: 'سجل الماء', icon: Droplets },
  { href: '/training-log', label: 'سجل التمارين', icon: Dumbbell },
  { href: '/wearables', label: 'ربط الساعة', icon: Watch },
  { href: '/recovery-log', label: 'النوم والاستشفاء', icon: Moon },
  { href: '/competition-mode', label: 'وضع البطولة', icon: Trophy },
  { href: '/supplements', label: 'دليل المكملات', icon: Pill },
  { href: '/reports', label: 'التقارير', icon: FileText },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/messages', label: 'الرسائل', icon: MessageSquare },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

const ROLE_NAV: Record<string, { href: string; label: string; icon: typeof Users }[]> = {
  coach: [{ href: '/coach/dashboard', label: 'لوحة المدرب', icon: Users }],
  dietitian: [{ href: '/coach/dashboard', label: 'لوحة الاختصاصي', icon: Users }],
  admin: [{ href: '/admin/dashboard', label: 'لوحة الإدارة', icon: ShieldCheck }],
};

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
}) {
  const pathname = usePathname();

  const roleItems = ROLE_NAV[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} />

      {/* القائمة الجانبية للحاسوب */}
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 border-l border-slate-200 bg-white pt-20 lg:block">
        <nav className="h-full space-y-0.5 overflow-y-auto px-3 pb-8">
          {roleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                pathname.startsWith(item.href)
                  ? 'bg-ocean-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {roleItems.length > 0 && <div className="my-2 border-t border-slate-100" />}
          {NAV.map((item) => {
            const isActive =
              item.href === '/my-plans'
                ? pathname === '/my-plans' || pathname.startsWith('/plan/')
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-ocean-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-slate-100" />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        </nav>
      </aside>

      {/* المحتوى */}
      <main className="px-4 pb-12 pt-6 lg:mr-64 lg:px-8">{children}</main>
    </div>
  );
}
