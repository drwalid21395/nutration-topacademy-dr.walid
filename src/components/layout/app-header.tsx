'use client';

import { useState, useEffect } from 'react';
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
  Users,
  ShieldCheck,
  UserCheck,
  LogOut,
  Menu,
  X,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { ROLES } from '@/lib/constants';

const GROUPS = [
  {
    key: 'profile',
    label: 'ملف السباح',
    icon: UserCheck,
    items: [
      { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
      { href: '/swimmer-profile', label: 'ملف السباح', icon: ClipboardList },
      { href: '/my-profile', label: 'ملخص بياناتي', icon: UserCheck },
      { href: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
  {
    key: 'nutrition',
    label: 'التغذية والخطط',
    icon: Salad,
    items: [
      { href: '/calculator', label: 'حاسبة الاحتياجات', icon: Calculator },
      { href: '/plan/create', label: 'إنشاء خطة غذائية', icon: Salad },
      { href: '/meal-analyzer', label: 'محلل الوجبات', icon: Camera },
      { href: '/food-log', label: 'سجل الطعام', icon: Utensils },
      { href: '/supplements', label: 'دليل المكملات', icon: Pill },
    ],
  },
  {
    key: 'tracking',
    label: 'المتابعة اليومية',
    icon: Activity,
    items: [
      { href: '/water-log', label: 'سجل الماء', icon: Droplets },
      { href: '/training-log', label: 'سجل التمارين', icon: Dumbbell },
      { href: '/recovery-log', label: 'النوم والاستشفاء', icon: Moon },
      { href: '/competition-mode', label: 'وضع البطولة', icon: Trophy },
      { href: '/reports', label: 'التقارير', icon: FileText },
      { href: '/notifications', label: 'الإشعارات', icon: Bell },
      { href: '/messages', label: 'الرسائل', icon: MessageSquare },
    ],
  },
];

const ROLE_NAV: Record<string, { href: string; label: string; icon: typeof Users }[]> = {
  coach: [{ href: '/coach/dashboard', label: 'لوحة المدرب', icon: Users }],
  dietitian: [{ href: '/coach/dashboard', label: 'لوحة الاختصاصي', icon: Users }],
  admin: [{ href: '/admin/dashboard', label: 'لوحة الإدارة', icon: ShieldCheck }],
};

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/swimmer-profile': 'ملف السباح',
  '/my-profile': 'ملخص بياناتي',
  '/calculator': 'حاسبة الاحتياجات',
  '/plan/create': 'إنشاء خطة غذائية',
  '/meal-analyzer': 'محلل الوجبات',
  '/food-log': 'سجل الطعام',
  '/water-log': 'سجل الماء',
  '/training-log': 'سجل التمارين',
  '/recovery-log': 'النوم والاستشفاء',
  '/competition-mode': 'وضع البطولة',
  '/supplements': 'دليل المكملات',
  '/reports': 'التقارير',
  '/notifications': 'الإشعارات',
  '/messages': 'الرسائل',
  '/settings': 'الإعدادات',
  '/coach/dashboard': 'لوحة المدرب',
  '/admin/dashboard': 'لوحة الإدارة',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/plan/')) return 'خطة غذائية';
  return 'لوحة التحكم';
}

export function AppHeader({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const roleItems = ROLE_NAV[user.role] ?? [];

  useEffect(() => setDrawerOpen(false), [pathname]);

  const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  function handleGroupClick(key: string) {
    if (isMobile()) setDrawerOpen(true);
    else setOpenMenu(openMenu === key ? null : key);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ocean-900 hover:bg-ocean-50 lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="h-6 w-6" />
          </button>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            {GROUPS.map((g) => {
              const isOpen = openMenu === g.key;
              const isActive = g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
              return (
                <div key={g.key} className="relative">
                  <button
                    onClick={() => handleGroupClick(g.key)}
                    onMouseEnter={() => {
                      if (!isMobile()) setOpenMenu(g.key);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold transition-colors lg:px-3',
                      isActive ? 'bg-ocean-600 text-white shadow-md' : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
                    )}
                  >
                    <span>{g.label}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && !isMobile() && (
                    <div
                      onMouseLeave={() => setOpenMenu(null)}
                      className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-xl"
                    >
                      {g.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                            pathname === item.href || pathname.startsWith(item.href + '/')
                              ? 'bg-ocean-600 text-white'
                              : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <Logo variant="dark" />
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm font-bold text-slate-700 md:block">{pageTitle}</span>
          <span className="hidden rounded-full bg-ocean-50 px-3 py-1 text-xs font-bold text-ocean-700 sm:block">
            {ROLES[user.role as keyof typeof ROLES] ?? user.role}
          </span>
          <Link href="/my-profile" className="flex items-center gap-2" aria-label="ملخص بيانات السباح">
            <UserAvatar name={user.name} image={user.image} size="md" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </Link>
        </div>
      </header>

      {/* القائمة الجانبية للجوال — كاملة المجموعات */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ocean-950/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <Logo variant="dark" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق القائمة"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              {roleItems.length > 0 && (
                <div className="space-y-0.5">
                  {roleItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
                        pathname === item.href || pathname.startsWith(item.href + '/')
                          ? 'bg-ocean-600 text-white'
                          : 'text-slate-600 hover:bg-ocean-50'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
              {GROUPS.map((g) => (
                <div key={g.key}>
                  <p className="mb-1.5 px-3 text-xs font-black text-ocean-600">{g.label}</p>
                  <div className="space-y-0.5">
                    {g.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
                          pathname === item.href || pathname.startsWith(item.href + '/')
                            ? 'bg-ocean-600 text-white'
                            : 'text-slate-600 hover:bg-ocean-50'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
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
    </>
  );
}
