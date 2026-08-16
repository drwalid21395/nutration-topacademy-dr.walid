/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/layout/app-shell.tsx

وظيفة الملف:
"الهيكل العام" للمستخدم المسجل:
- شريط علوي (AppHeader).
- قائمة جانبية بكل روابط الخدمات.
- منطقة المحتوى التي تأتي من الصفحة.

لماذا نحتاجه؟
كل الصفحات المحمية تحتاج نفس الشريط الجانبي. بدل تكراره
في كل صفحة، نكتبه مرة واحدة هنا ونغلف به المحتوى.

متى يعمل؟
في كل صفحة محمية (بعد تسجيل الدخول) مثل dashboard وcalculator.

من يستدعيه؟
صفحات الخادم (Server Components) مثل src/app/dashboard/page.tsx:
تمرر user (بيانات المستخدم) وchildren (المحتوى).

'use client':
يحتاج المتصفح لأن فيه usePathname (لتمييز الرابط النشط)
وsignOut (تسجيل الخروج).

ترتيب التنفيذ:
1. نحسب pathname (المسار الحالي) لتلوين الرابط النشط.
2. roleItems = روابط خاصة بدور المستخدم (مدرب/إداري...).
3. نعرض: الشريط العلوي + القائمة الجانبية + المحتوى.

العلاقة مع الملفات:
- AppHeader من components/layout.
- cn من lib/utils (دمج الفئات).
- كل الصفحات المحمية تمرر children هنا.
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
// signOut: تسجيل الخروج (من مكتبة next-auth للمتصفح).
import { signOut } from 'next-auth/react';
// أيقونات — كل سطر اسم أيقونة تُستخدم في القائمة.
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

// ========================================
// 2. قائمة الروابط الرئيسية (لكل المستخدمين)
// ========================================

// NAV: كل خدمات المستخدم العادي (سباح).
// href: المسار. label: النص. icon: الأيقونة.
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
  { href: '/safety', label: 'مراقبة السلامة', icon: ShieldCheck },
  { href: '/recovery-log', label: 'النوم والاستشفاء', icon: Moon },
  { href: '/competition-mode', label: 'وضع البطولة', icon: Trophy },
  { href: '/supplements', label: 'دليل المكملات', icon: Pill },
  { href: '/reports', label: 'التقارير', icon: FileText },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/messages', label: 'الرسائل', icon: MessageSquare },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

// ========================================
// 3. روابط الأدوار الخاصة (مدرب / إداري)
// ========================================

// ROLE_NAV: روابط إضافية تظهر حسب دور المستخدم.
// Record: نوع يقول "كائن مفاتيحه نصوص وقيمته قائمة روابط".
const ROLE_NAV: Record<string, { href: string; label: string; icon: typeof Users }[]> = {
  coach: [{ href: '/coach/dashboard', label: 'لوحة المدرب', icon: Users }],
  dietitian: [{ href: '/coach/dashboard', label: 'لوحة الاختصاصي', icon: Users }],
  admin: [{ href: '/admin/dashboard', label: 'لوحة الإدارة', icon: ShieldCheck }],
};

// ========================================
// 4. المكوّن الرئيسي
// ========================================

/*
-----------------------------------------
المكوّن: AppShell
-----------------------------------------
Props:
- children: المحتوى القادم من الصفحة المحمية.
- user: بيانات المستخدم (الاسم، البريد، الدور...).

ترتيب التنفيذ:
1. pathname = المسار الحالي.
2. roleItems = روابط دور المستخدم (قد تكون فارغة).
3. عرض الشريط العلوي + القائمة + المحتوى.

يتم استدعاؤه من: الصفحات المحمية (dashboard، calculator، ...)
-----------------------------------------
*/
export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
}) {
  // المسار الحالي — مثال: /dashboard أو /food-log.
  const pathname = usePathname();

  // روابط خاصة بدور المستخدم، أو قائمة فارغة لو دور عادي.
  const roleItems = ROLE_NAV[user.role] ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* الشريط العلوي (اسم المستخدم + صورة + إشعارات). */}
      <AppHeader user={user} />

      {/* القائمة الجانبية — تظهر فقط على شاشات lg فما فوق.
          ثابتة على يمين الصفحة (RTL) بعرض 64. */}
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 border-l border-slate-200 bg-white pt-20 lg:block">
        <nav className="h-full space-y-0.5 overflow-y-auto px-3 pb-8">
          {/* أولًا: روابط الدور الخاص (لو موجودة). */}
          {roleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                // الرابط النشط: نتحقق أن المسار الحالي يبدأ بهذا الرابط.
                pathname.startsWith(item.href)
                  ? 'bg-ocean-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-ocean-50 hover:text-ocean-700'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {/* فاصل بصري لو ظهرت روابط الدور. */}
          {roleItems.length > 0 && <div className="my-2 border-t border-slate-100" />}

          {/* روابط المستخدم العامة. */}
          {NAV.map((item) => {
            // حالة خاصة: كل روابط /plan/* (إنشاء خطة، خطة محددة)
            // تندرج تحت "البرنامج الغذائي" → تعتبر نشطة معها.
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

          {/* زر تسجيل الخروج في نهاية القائمة. */}
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

      {/* المحتوى: نترك مسافة من اليمين (lg:mr-64) حتى لا يغطيه
          الشريط الجانبي. children = محتوى الصفحة الحالية. */}
      <main className="px-4 pb-12 pt-6 lg:mr-64 lg:px-8">{children}</main>
    </div>
  );
}
