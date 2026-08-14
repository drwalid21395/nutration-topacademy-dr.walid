/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/layout/logo.tsx

وظيفة الملف:
شعار الأكاديمية — يعرض صورة اللوجو مع اسم
"TOP ACADEMY" وتحت عنوانه "Smart Swimmer Nutrition"
واسم الدكتور. عند الضغط عليه ينقل المستخدم للرئيسية (/).

لماذا نحتاجه؟
الشعار يُستخدم في الهيدر، الفوتر، صفحة الدخول،
وقائمة الجوال — بدل تكراره نصنعه مرة واحدة هنا.

'use client':
لا يحتاجها — مكوّن ثابت بدون تفاعل.

متى يعمل؟
في كل صفحة تقريبًا (داخل AppHeader وFooter).

من يستدعي هذا الملف؟
- src/components/layout/app-header.tsx
- src/components/layout/footer.tsx
- src/components/auth/auth-layout.tsx

الملفات التي يتعامل معها:
- next/link (Link للانتقال للرئيسية).
- lib/constants (BRAND: اسم الدكتور ولقبه).
- lib/utils (cn لدمج الفئات حسب المتغير).

الميزة المهمة:
خاصية variant — 'dark' (خلفية فاتحة → نص داكن)
أو 'light' (خلفية داكنة → نص أبيض) لتظهر بشكل صحيح
في كل مكان، عبر دمج الفئات شرطيًا بـ cn.
==================================================
*/

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/constants';

/**
 * شعار الأكاديمية — صورة اللوجو أعلى الموقع وفي القوائم.
 */
export function Logo({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  // dark: هل نعرض النسخة الداكنة (النص الملون للخلفية الفاتحة)؟
  const dark = variant === 'dark';
  return (
    <Link href="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Top Academy">
      {/* مربع صورة اللوجو — يتغير لونه حسب المتغير */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform group-hover:scale-105',
          dark ? 'bg-white ring-1 ring-ocean-100' : 'bg-white/10 ring-1 ring-white/20'
        )}
      >
        <img
          src="/images/academy-logo.png"
          alt="Top Academy"
          width={40}
          height={40}
          className="h-full w-full object-cover"
        />
      </div>
      {/* النصوص: اسم الأكاديمية + الوصف + اسم الدكتور */}
      <div className="leading-tight">
        <span
          className={cn(
            'block text-lg font-black tracking-wider',
            dark ? 'text-ocean-900' : 'text-white'
          )}
        >
          TOP ACADEMY
        </span>
        <span className={cn('block text-[10px] font-semibold', dark ? 'text-ocean-500' : 'text-ocean-200')}>
          Smart Swimmer Nutrition
        </span>
        <span className={cn('block text-[9px] font-semibold leading-tight', dark ? 'text-ocean-400' : 'text-ocean-300/80')}>
          {BRAND.doctorTitle} {BRAND.doctor}
        </span>
      </div>
    </Link>
  );
}
