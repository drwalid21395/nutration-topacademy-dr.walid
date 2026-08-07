'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Settings,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { cn } from '@/lib/utils';
import { ROLES } from '@/lib/constants';

const NAV = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/swimmer-profile', label: 'ملف السباح', icon: ClipboardList },
  { href: '/calculator', label: 'حاسبة الاحتياجات', icon: Calculator },
  { href: '/plan/create', label: 'إنشاء خطة غذائية', icon: Salad },
  { href: '/meal-analyzer', label: 'محلل الوجبات', icon: Camera },
  { href: '/food-log', label: 'سجل الطعام', icon: Utensils },
  { href: '/water-log', label: 'سجل الماء', icon: Droplets },
  { href: '/training-log', label: 'سجل التمارين', icon: Dumbbell },
  { href: '/recovery-log', label: 'النوم والاستشفاء', icon: Moon },
  { href: '/competition-mode', label: 'وضع البطولة', icon: Trophy },
  { href: '/supplements', label: 'دليل المكملات', icon: Pill },
  { href: '/reports', label: 'التقارير', icon: FileText },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const roleItems = ROLE_NAV[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-ocean-900 hover:bg-ocean-50 lg:hidden" aria-label="فتح القائمة">
            <Menu className="h-6 w-6" />
          </button>
          <Logo variant="dark" />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-ocean-50 px-3 py-1 text-xs font-bold text-ocean-700 sm:block">
            {ROLES[user.role as keyof typeof ROLES] ?? user.role}
          </span>
          <div className="flex items-center gap-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-ocean-200" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-ocean-500 to-ocean-700 text-sm font-black text-white">
                {(user.name ?? '؟').charAt(0)}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
        </div>
      </header>

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
              <item.icon className="h-4.5 w-4.5 h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {roleItems.length > 0 && <div className="my-2 border-t border-slate-100" />}
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                pathname === item.href
                  ? 'bg-ocean-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
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

      {/* القائمة الجانبية للجوال */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ocean-950/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <Logo variant="dark" />
              <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق القائمة">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {roleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
                    pathname.startsWith(item.href) ? 'bg-ocean-600 text-white' : 'text-slate-600 hover:bg-ocean-50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
                    pathname === item.href ? 'bg-ocean-600 text-white' : 'text-slate-600 hover:bg-ocean-50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-100 p-3">
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* المحتوى */}
      <main className="px-4 pb-12 pt-6 lg:mr-64 lg:px-8">{children}</main>
    </div>
  );
}
