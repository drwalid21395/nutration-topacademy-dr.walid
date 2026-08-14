/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/ui/button.tsx

وظيفة الملف:
مكوّن الزر الموحّد في التطبيق — بأنماط (variants) وأحجام
(sizes) جاهزة، مع دعم حالة تحميل (loading) تظهر مؤشرًا دوّارًا
وتعطّل الزر تلقائيًا.

لماذا نحتاجه؟
كل أزرار النظام (حفظ، إرسال، حذف، تأكيد، ...) تمر من هنا
فيتوحّد المظهر والسلوك، وتكون الإضافة لأي تصميم جديد من
نقطة واحدة.

'use client'؟
لا نحتاجه — مكوّن عرض خالص.

متى يعمل؟
في كل صفحة تحتوي أزرارًا.

من يستدعي هذا الملف؟
كل صفحات ومكوّنات التطبيق:
import { Button } from '@/components/ui/button';

الملفات التي يتعامل معها:
- lib/utils (دالة cn لدمج الأصناف).
- أصناف جاهزة من CSS: btn-primary، btn-secondary، btn-gold، btn-ghost.

ترتيب العمل:
1. نحدد النمط (الافتراضي primary) والحجم (الافتراضي md) ↓
2. ندمج الأصناف الناتجة مع أي أصناف إضافية ↓
3. إن كانت loading أو disabled → نعطل الزر ونظهر المؤشر
==================================================
*/

import React from 'react';
import { cn } from '@/lib/utils';

// ========================================
// 1. الأنماط والأحجام المتاحة
// ========================================

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// أنماط الأزرار — أربعة أنماط من CSS الجاهز + نمط الخطر اليدوي.
const variants: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  gold: 'btn-gold',
  ghost: 'btn-ghost',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50',
};

// أحجام الأزرار الثلاثة.
const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

// ========================================
// 2. خصائص الزر
// ========================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// ========================================
// 3. المكوّن الرئيسي: Button
// ========================================

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {/* أثناء التحميل: مؤشر دوّار صغير قبل النص */}
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
