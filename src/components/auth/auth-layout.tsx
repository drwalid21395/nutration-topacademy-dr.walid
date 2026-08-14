/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/auth/auth-layout.tsx

وظيفة الملف:
هيكل صفحة الدخول والتسجيل — تصميم من نصفين:
- النصف الأيسر (على الشاشات الكبيرة): لوحة بصرية جذابة
  بشعار الأكاديمية واسم الدكتور.
- النصف الأيمن: بطاقة النموذج (الدخول/التسجيل/نسيت كلمة المرور)
  يأتي بداخلها children.

لماذا نحتاجه؟
ليوحد شكل كل صفحات المصادقة في مكان واحد بدل تكراره.

نوعه: Server Component (بدون 'use client').
لا يوجد فيه أي تفاعل — مجرد هيكل وعرض.

متى يعمل؟
في كل صفحة دخول/تسجيل.

من يستدعي هذا الملف؟
- src/app/login/page.tsx
- src/app/register/page.tsx
- وصفحات استعادة كلمة المرور إن وُجدت.

الملفات التي يتعامل معها:
- Logo (شعار الأكاديمية) من components/layout/logo.
- BRAND من lib/constants (اسم الدكتور والعلامة التجارية).
- lucide-react: أيقونة Waves.

ترتيب العمل:
1. الصفحة الأب تضع العنوان (title) والنموذج (children) داخله ↓
2. على الشاشات الكبيرة يظهر النصف البصري + نصف النموذج ↓
3. على الجوال يظهر الشعار أعلى النموذج فقط
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// Link من next/link: تنقل بين الصفحات (إن لزم).
import Link from 'next/link';
// Logo: شعار الأكاديمية (مكوّن محلي من مجلد layout).
import { Logo } from '@/components/layout/logo';
// Waves: أيقونة موجات من lucide-react (مكتبة خارجية).
import { Waves } from 'lucide-react';
// BRAND: بيانات العلامة التجارية (اسم الدكتور، السنة، الاسم).
import { BRAND } from '@/lib/constants';

// ========================================
// 2. المكوّن الرئيسي: AuthLayout
// ========================================

// AuthLayout: هيكل صفحة المصادقة.
// Props: title (عنوان النموذج)، subtitle (وصف اختياري)،
// children (النموذج نفسه القادم من الصفحة الأب).
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* الجانب البصري: يظهر فقط على الشاشات الكبيرة (lg) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-hero-waves p-10 text-white lg:flex">
        {/* الشعار بالنسخة الفاتحة (مخصص للخلفيات الداكنة) */}
        <Logo variant="light" />
        <div className="relative z-10">
          <Waves className="mb-6 h-14 w-14 text-ocean-300" />
          <h2 className="text-3xl font-black leading-snug">
            كل سباح يستحق خطة غذائية
            <span className="block text-gold-400">مصممة خصيصًا له</span>
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-slate-300">
            حساب علمي للسعرات والمغذيات، خطط مخصصة، تحليل الوجبات بالكاميرا، ومتابعة يومية شاملة.
          </p>
          {/* بطاقة صغيرة تعرض اسم الدكتور من ثوابت العلامة */}
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-black">
              د
            </div>
            <div>
              <p className="text-sm font-bold">{BRAND.doctorTitle}</p>
              <p className="text-xs text-slate-300">{BRAND.doctor} · {BRAND.nameAr}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">© {BRAND.year} {BRAND.nameEn} — كل الحقوق محفوظة</p>
      </div>

      {/* نموذج: يشغل كل العرض على الجوال ونصفه على الشاشات الكبيرة */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* على الجوال فقط نعرض الشعار بالنسخة الداكنة */}
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h1 className="text-2xl font-black text-ocean-900">{title}</h1>
          {/* الوصف يظهر فقط لو مرّرته الصفحة الأب */}
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          {/* هنا يأتي النموذج الفعلي (حقول الدخول/التسجيل...) */}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
