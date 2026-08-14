/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/ui/forms.tsx

وظيفة الملف:
مكونات النماذج الجاهزة (Form Controls) — وحدات موحّدة
لكل عناصر الإدخال في التطبيق:
- Input: حقل نصي.
- Select: قائمة منسدلة.
- Textarea: منطقة نص طويلة.
- Field: غلاف حقل مع تسمية (label) وملاحظة اختيارية.
- Toggle: زر تبديل تشغيل/إيقاف (Switch).

لماذا نحتاجه؟
جميع الحقول في كل النماذج (الملف الشخصي، الإعدادات، الخطط)
تستخدم هذه المكونات — فتتطابق الألوان والأحجام، ويظهر رسالة
خطأ أسفل أي حقل تلقائيًا عند تمرير خاصية error.

'use client'؟
لا نحتاجه — مكونات عرض خالصة.

متى يعمل؟
كل مرة تُستخدم في نموذج ما.

من يستدعي هذا الملف؟
كل النماذج في التطبيق:
import { Input, Select, Textarea, Field, Toggle } from '@/components/ui/forms';

الملفات التي يتعامل معها:
- lib/utils (دالة cn لدمج الأصناف).
- أصناف جاهزة من CSS: input، label.

ترتيب العمل:
1. نستقبل خصائص الحقل (+ خاصية error اختيارية) ↓
2. نرسم عنصر الإدخال داخل غلاف بعرض كامل ↓
3. إن وُجد خطأ → حد أحمر ورسالة تحته
==================================================
*/

import React from 'react';
import { cn } from '@/lib/utils';

// ========================================
// Input: حقل نصي مع دعم رسالة خطأ
// ========================================

export function Input({
  className,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="w-full">
      {/* إن وُجد خطأ نضيف حدًا أحمر للحقل */}
      <input className={cn('input', error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ========================================
// Select: قائمة منسدلة
// ========================================

export function Select({
  className,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <div className="w-full">
      <select className={cn('input appearance-none bg-white rtl:pr-3', error && 'border-red-400', className)} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ========================================
// Textarea: منطقة نص متعددة الأسطر
// ========================================

export function Textarea({
  className,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div className="w-full">
      {/* ارتفاع افتراضي 90px وقابل للسحب عموديًا */}
      <textarea className={cn('input min-h-[90px] resize-y', error && 'border-red-400', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ========================================
// Field: غلاف الحقل — تسمية + المحتوى + ملاحظة
// ========================================

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* التسمية فوق الحقل، مع نجمة حمراء إن كان مطلوبًا */}
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ========================================
// Toggle: زر تبديل تشغيل/إيقاف (Switch)
// ========================================

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-right transition-colors hover:bg-slate-50"
    >
      {/* النص: التسمية + وصف اختياري */}
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      {/* المفتاح البصري: ممتلئ بالأزرق عند التشغيل، ورمادي عند الإيقاف */}
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-ocean-500' : 'bg-slate-300'
        )}
      >
        {/* الدائرة البيضاء تتحرك يمينًا/يسارًا حسب الحالة */}
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'
          )}
        />
      </span>
    </button>
  );
}
