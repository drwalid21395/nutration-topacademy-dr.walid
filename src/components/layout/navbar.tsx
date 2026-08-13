/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/layout/navbar.tsx

وظيفة الملف:
شريط التنقل العلوي للزوار (الصفحة الرئيسية وصفحات التعريف).
يظهر: الشعار، روابط الصفحات، أزرار الدخول/التسجيل، قائمة الجوال.

لماذا نحتاجه؟
بدون شريط تنقل لن يستطيع الزائر التجول بين أقسام الموقع.

نقطة مهمة:
لو المستخدم مسجل → نعرض بدلًا منه AppHeader (شريط مختلف
مخصص لصفحات الدخول). أي أن هذا المكون خاص بالزوار فقط.

'use client':
هذا المكون يعمل في المتصفح لأنه يحتاج:
- useState (قائمة مفتوحة/مغلقة) وuseEffect (تتبع التمرير).
- signOut (تسجيل الخروج).

متى يعمل؟
يُعرض في الصفحة الرئيسية (page.tsx) وبعض صفحات التعريف.

ترتيب التنفيذ:
1. نفحص التمرير (scrolled) لتغيير خلفية الشريط.
2. نحسب المسار الحالي (pathname) لتمييز الرابط النشط.
3. لو مسجل → AppHeader.
4. وإلا → الشريط + القائمة (سطح المكتب والجوال).
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// React hooks (من مكتبة React نفسها):
// useState: حفظ قيمة تتغير (القائمة مفتوحة؟).
// useEffect: تنفيذ كود بعد عرض المكون (مراقبة التمرير).
import { useState, useEffect } from 'react';
import Link from 'next/link'; // التنقل بين الصفحات
import { usePathname } from 'next/navigation'; // معرفة المسار الحالي
import { signOut } from 'next-auth/react'; // تسجيل الخروج (مكتبة خارجية)
// أيقونات lucide.
import { Menu, X, LogIn, UserPlus, LayoutDashboard, Bell, LogOut } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { AppHeader } from '@/components/layout/app-header';
import { cn } from '@/lib/utils';

// ========================================
// 2. بيانات ثابتة: روابط القائمة
// ========================================

// NAV_LINKS: روابط الزوار في منتصف الشريط.
const NAV_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/supplements', label: 'المكملات' },
  { href: '/supplements/calculator', label: 'حاسبة المكملات' },
  { href: '/competition-mode', label: 'وضع البطولة' },
  { href: '/about', label: 'من نحن' },
  { href: '/contact', label: 'تواصل معنا' },
];

// ========================================
// 3. المكوّن الرئيسي
// ========================================

/*
-----------------------------------------
المكوّن: Navbar
-----------------------------------------
Props (ما يصل إليه من الصفحة الأب):
- isLoggedIn: هل الزائر مسجل؟
- user: بيانات المستخدم (اختياري).

ترتيب التنفيذ:
1. useState: open (قائمة الجوال) وscrolled (شريط مظلل).
2. useEffect: نضيف مستمع تمرير لتغيير الخلفية.
3. useEffect: نغلق القائمة عند تغيير الصفحة.
4. لو مسجل → AppHeader. وإلا → الشريط الكامل.
يتم استدعاؤه من: src/app/page.tsx
-----------------------------------------
*/
export function Navbar({
  isLoggedIn = false,
  user,
}: {
  isLoggedIn?: boolean;
  user?: { name?: string | null; email?: string | null; image?: string | null; role: string } | null;
}) {
  // open: هل قائمة الجوال مفتوحة؟
  const [open, setOpen] = useState(false);
  // scrolled: هل مرر المستخدم الصفحة؟ (يغير شفافية الشريط)
  const [scrolled, setScrolled] = useState(false);
  // pathname: المسار الحالي (مثل /supplements) — لتلوين الرابط النشط.
  const pathname = usePathname();

  // useEffect (دالة مؤثرة): تعمل بعد عرض المكون.
  // نضيف مستمع تمرير window.scroll — عند كل تمرير نحدّث scrolled.
  // return () => ...: "تنظيف" عند إزالة المكون (إزالة المستمع).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // عند تغيير الصفحة (pathname) → أغلق قائمة الجوال.
  // [] في السطر السابق تعني "مرة واحدة". هنا [pathname] تعني "عند تغيره".
  useEffect(() => setOpen(false), [pathname]);

  // لو مسجل → نعرض شريط المستخدم (AppHeader) بدل شريط الزوار.
  if (isLoggedIn && user) {
    return <AppHeader user={user} />;
  }

  return (
    // الشريط ثابت أعلى الصفحة (sticky). الخلفية تتغير حسب scrolled.
    <header
      className={cn(
        'sticky top-0 z-40 transition-all',
        scrolled ? 'bg-white/90 shadow-sm backdrop-blur-lg' : 'bg-white/60 backdrop-blur'
      )}
    >
      <nav className="container-app flex h-16 items-center justify-between gap-4">
        {/* الشعار (اسم الأكاديمية). */}
        <Logo variant="dark" />

        {/* روابط سطح المكتب (تظهر من عرض lg فما فوق). */}
        <div className="hidden items-center gap-1 lg:flex">
          {/* map: نرسم رابطًا لكل عنصر في NAV_LINKS. */}
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              // الرابط النشط (نحن عليه الآن) يظهر بخلفية مميزة.
              // cn: تدمج الفئات وتختار الشرط المناسب.
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                pathname === l.href ? 'bg-ocean-50 text-ocean-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ocean-700'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* أزرار الدخول/التسجيل (سطح المكتب). */}
        <div className="hidden items-center gap-2 lg:flex">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="btn-primary">
                <LayoutDashboard className="h-4 w-4" />
                لوحة التحكم
              </Link>
              <Link href="/notifications" className="btn-secondary" aria-label="الإشعارات">
                <Bell className="h-4 w-4" />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </Link>
              <Link href="/register" className="btn-primary">
                <UserPlus className="h-4 w-4" />
                إنشاء حساب
              </Link>
            </>
          )}
        </div>

        {/* زر القائمة للجوال (يظهر أقل من lg) — يبدّل open. */}
        <button
          className="rounded-lg p-2 text-ocean-900 hover:bg-ocean-50 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="القائمة"
        >
          {/* أيقونة تتغير: X عندما مفتوحة، Menu عندما مغلقة. */}
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* قائمة الجوال: تظهر فقط لو open = true (شرط &&). */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-lg lg:hidden">
          <div className="flex flex-col gap-1">
            {/* نفس الروابط لكن عمودية. */}
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-semibold',
                  pathname === l.href ? 'bg-ocean-50 text-ocean-700' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                {l.label}
              </Link>
            ))}
            {/* أزرار الدخول/الخروج للجوال. */}
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="btn-primary flex-1">
                    <LayoutDashboard className="h-4 w-4" />
                    لوحة التحكم
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary flex-1">
                    <LogIn className="h-4 w-4" />
                    دخول
                  </Link>
                  <Link href="/register" className="btn-primary flex-1">
                    <UserPlus className="h-4 w-4" />
                    إنشاء حساب
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
