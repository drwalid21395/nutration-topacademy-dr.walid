/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/layout/app-header.tsx

وظيفة الملف:
رأس (هيدر) لوحة التحكم — يظهر بعد تسجيل الدخول:
- شريط علوي: القوائم الرئيسية (مجموعات + روابط)،
  اسم الصفحة الحالية، دور المستخدم، صورته واسمه.
- قائمة منسدلة لكل مجموعة عند التمرير (hover) أو النقر.
- درج جانبي (drawer) للجوال يعرض كل الروابط.
- زر تسجيل الخروج.

لماذا نحتاجه؟
هو "خريطة التنقل" لكل التطبيق بعد الدخول — بدونه
لا يستطيع المستخدم الوصول لأي صفحة بسهولة.

'use client':
يعمل في المتصفح لأنه يستخدم useState (فتح/إغلاق القوائم)
وusePathname (الصفحة الحالية لتمييز الرابط النشط) وsignOut.

متى يعمل؟
على الشاشات الداخلية عبر AppShell (بعد تسجيل الدخول).

من يستدعي هذا الملف؟
src/components/layout/app-shell.tsx.

الملفات التي يتعامل معها:
- next-auth/react: signOut (تسجيل الخروج).
- next/navigation: usePathname.
- Logo، UserAvatar، lucide-react أيقونات، lib/utils cn، ROLES من lib/constants.

ترتيب العمل:
1. نعرف قوائم GROUPS (3 مجموعات) وROLE_NAV (لوحات الأدوار)
   وPAGE_TITLES (عناوين الصفحات) ↓
2. نعرض الشريط العلوي مع القوائم المنسدلة ↓
3. عند فتح قائمة نسجّل الرابط النشط حسب المسار الحالي ↓
4. على الجوال: درج جانبي كامل + خروج
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useState (فتح/إغلاق القوائم)، useEffect (إغلاق عند تغيير الصفحة).
import { useState, useEffect } from 'react';
// Link: روابط داخلية سريعة.
import Link from 'next/link';
// usePathname: المسار الحالي لتمييز الرابط النشط.
import { usePathname } from 'next/navigation';
// signOut: تسجيل الخروج من NextAuth.
import { signOut } from 'next-auth/react';
// أيقونات كثيرة من lucide-react لكل قائمة.
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
  BookOpen,
  ChevronDown,
  Watch,
} from 'lucide-react';
// Logo: الشعار.
import { Logo } from '@/components/layout/logo';
// UserAvatar: صورة المستخدم.
import { UserAvatar } from '@/components/ui/user-avatar';
// cn: دمج فئات Tailwind شرطيًا.
import { cn } from '@/lib/utils';
// ROLES: أسماء الأدوار العربية (admin، coach...).
import { ROLES } from '@/lib/constants';

// ========================================
// 2. بيانات القوائم (ثابتة)
// ========================================

// GROUPS: المجموعات الرئيسية الثلاث للقائمة —
// كل مجموعة لها عنوان وأيقونة وقائمة روابط (رابط + عنوان + أيقونة).
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
      { href: '/my-plans', label: 'البرنامج الغذائي', icon: BookOpen },
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
      { href: '/wearables', label: 'ربط الساعة', icon: Watch },
      { href: '/safety', label: 'مراقبة السلامة', icon: ShieldCheck },
      { href: '/recovery-log', label: 'النوم والاستشفاء', icon: Moon },
      { href: '/competition-mode', label: 'وضع البطولة', icon: Trophy },
      { href: '/reports', label: 'التقارير', icon: FileText },
      { href: '/notifications', label: 'الإشعارات', icon: Bell },
      { href: '/messages', label: 'الرسائل', icon: MessageSquare },
    ],
  },
];

// ROLE_NAV: روابط إضافية حسب الدور (تظهر أعلى القائمة).
const ROLE_NAV: Record<string, { href: string; label: string; icon: typeof Users }[]> = {
  coach: [{ href: '/coach/dashboard', label: 'لوحة المدرب', icon: Users }],
  dietitian: [{ href: '/coach/dashboard', label: 'لوحة الاختصاصي', icon: Users }],
  admin: [{ href: '/admin/dashboard', label: 'لوحة الإدارة', icon: ShieldCheck }],
};

// PAGE_TITLES: عنوان كل صفحة ليظهر بجانب اللوجو.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/swimmer-profile': 'ملف السباح',
  '/my-profile': 'ملخص بياناتي',
  '/calculator': 'حاسبة الاحتياجات',
  '/my-plans': 'البرنامج الغذائي',
  '/plan/create': 'إنشاء خطة غذائية',
  '/meal-analyzer': 'محلل الوجبات',
  '/food-log': 'سجل الطعام',
  '/water-log': 'سجل الماء',
  '/training-log': 'سجل التمارين',
  '/recovery-log': 'النوم والاستشفاء',
  '/wearables': 'ربط الساعة',
  '/safety': 'مراقبة السلامة',
  '/competition-mode': 'وضع البطولة',
  '/supplements': 'دليل المكملات',
  '/reports': 'التقارير',
  '/notifications': 'الإشعارات',
  '/messages': 'الرسائل',
  '/settings': 'الإعدادات',
  '/coach/dashboard': 'لوحة المدرب',
  '/admin/dashboard': 'لوحة الإدارة',
};

// getPageTitle: نبحث عن عنوان الصفحة الحالية في القاموس.
// صفحات الخطة /plan/xxx تأخذ عنوانًا عامًا "خطة غذائية".
function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/plan/')) return 'خطة غذائية';
  return 'لوحة التحكم';
}

// ========================================
// 3. المكوّن الرئيسي: AppHeader
// ========================================

// AppHeader: رأس اللوحة.
// Props: user — بيانات المستخدم (الاسم، البريد، الصورة، الدور).
export function AppHeader({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
}) {
  // drawerOpen: هل الدرج الجانبي مفتوح (جوال)؟
  const [drawerOpen, setDrawerOpen] = useState(false);
  // openMenu: أي قائمة منسدلة مفتوحة (مفتاح المجموعة أو null).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // pathname: المسار الحالي.
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  // roleItems: روابط الدور (لوحة المدرب/الإدارة...) إن وُجدت.
  const roleItems = ROLE_NAV[user.role] ?? [];

  // عند تغيير الصفحة نغلق الدرج تلقائيًا.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // isMobile: هل الشاشة جوال (أقل من 768 بكسل)؟
  const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  // عند النقر على مجموعة: جوال → نفتح الدرج؛ غير ذلك → قائمة منسدلة.
  function handleGroupClick(key: string) {
    if (isMobile()) setDrawerOpen(true);
    else setOpenMenu(openMenu === key ? null : key);
  }

  return (
    <>
      {/* الشريط العلوي الثابت أعلى الشاشة */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          {/* زر القائمة (يظهر على الجوال فقط) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ocean-900 hover:bg-ocean-50 lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="h-6 w-6" />
          </button>
          {/* القوائم الرئيسية (شاشات كبيرة) */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            {GROUPS.map((g) => {
              const isOpen = openMenu === g.key;
              // isActive: هل نحن داخل أي رابط من هذه المجموعة؟
              const isActive = g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
              return (
                <div key={g.key} className="relative">
                  {/* زر المجموعة — عند التمرير تفتح القائمة */}
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
                    {/* سهم يشير لأعلى عند الفتح */}
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {/* القائمة المنسدلة نفسها (تظهر عند الفتح وغير الجوال) */}
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
        {/* الجهة اليسرى: عنوان الصفحة + الدور + المستخدم */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm font-bold text-slate-700 md:block">{pageTitle}</span>
          {/* شارة الدور (مدرب/إدارة...) */}
          <span className="hidden rounded-full bg-ocean-50 px-3 py-1 text-xs font-bold text-ocean-700 sm:block">
            {ROLES[user.role as keyof typeof ROLES] ?? user.role}
          </span>
          {/* صورة واسم المستخدم (رابط لملخص بياناتي) */}
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
          {/* خلفية معتمة: الضغط عليها يغلق */}
          <div className="absolute inset-0 bg-ocean-950/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          {/* الدرج نفسه من جهة اليمين (لأن الواجهة عربية) */}
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
              {/* روابط الدور أعلى القائمة إن وُجدت */}
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
              {/* المجموعات الثلاث بروابطها */}
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
            {/* زر تسجيل الخروج أسفل الدرج */}
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
