/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/ui/index.tsx

وظيفة الملف:
مكتبة المكوّنات الجاهزة (Building Blocks) الخاصة بالتصميم —
تجمّع هنا كل الوحدات الأساسية المتكررة في التطبيق:
- Card (بطاقة)، CardHeader (ترويسة البطاقة)
- Alert (تنبيه ملون)، Badge (شارة/وسم صغير)
- Stat (إحصائية برقم)، ProgressBar (شريط تقدم)، ProgressRing (دائرة تقدم)
- Modal (نافذة منبثقة)، Spinner (مؤشر تحميل)، EmptyState (حالة فارغة)

لماذا نحتاجه؟
بدل تكرار نفس الكود (بكسلات، ألوان، تجاوب) في كل صفحة،
نعرّف هذه الوحدات مرة واحدة ثم نستخدمها في كل مكان —
فيتوحّد التصميم ويصبح التعديل من نقطة واحدة.

'use client'؟
لا نحتاجه — كلها مكوّنات عرض خالصة (بدون hooks/useState).

متى يعمل؟
كل المكوّنات في الملف تظهر عند تضمينها في أي صفحة.

من يستدعي هذا الملف؟
تقريبًا كل صفحات ومكوّنات التطبيق:
import { Card, Alert, Badge, ... } from '@/components/ui';

الملفات التي يتعامل معها:
- lib/utils (دالة cn لدمج الأصناف).
- الأصناف العامة: card، card-hover، shadow-card-lg (من CSS).

ترتيب العمل لكل مكوّن:
1. نستقبل خصائص العرض (نصوص، ألوان، أطفال React) ↓
2. نرسم الهيكل مع الأصناف المناسبة ↓
3. نضيف الأصناف الإضافية القادمة من المتصل عبر cn
==================================================
*/

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, CheckCircle2, XCircle, X } from 'lucide-react';

// ========================================
// Card: بطاقة/صندوق محتوى أساسية
// ========================================

export function Card({
  className,
  children,
  hover,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  );
}

// ========================================
// CardHeader: ترويسة بطاقة (عنوان + أيقونة + زر اختياري)
// ========================================

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* أيقونة داخل مربع أزرق فاتح */}
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-50 text-ocean-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-bold text-ocean-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {/* إجراء اختياري على يسار الترويسة */}
      {action}
    </div>
  );
}

// ========================================
// Alert: تنبيه ملون (معلومة/تحذير/خطر/نجاح)
// ========================================

type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

// ألوان كل نوع من التنبيهات.
const alertStyles: Record<AlertVariant, string> = {
  info: 'bg-ocean-50 border-ocean-200 text-ocean-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  danger: 'bg-red-50 border-red-200 text-red-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

// الأيقونة المناسبة لكل نوع.
const alertIcons: Record<AlertVariant, React.ReactNode> = {
  info: <Info className="h-5 w-5 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0" />,
  danger: <XCircle className="h-5 w-5 shrink-0" />,
  success: <CheckCircle2 className="h-5 w-5 shrink-0" />,
};

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible,
  onDismiss,
  className,
}: {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('relative flex gap-3 rounded-xl border p-4 text-sm', alertStyles[variant], className)}>
      {alertIcons[variant]}
      <div className="flex-1">
        {title && <p className="mb-1 font-bold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {/* زر إغلاق اختياري (dismissible) */}
      {dismissible && onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="إغلاق">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ========================================
// Badge: وسم/شارة صغيرة ملونة
// ========================================

export function Badge({
  children,
  color = 'ocean',
  className,
}: {
  children: React.ReactNode;
  color?: 'ocean' | 'gold' | 'green' | 'red' | 'slate';
  className?: string;
}) {
  // ألوان جاهزة حسب نوع الوسم.
  const colors = {
    ocean: 'bg-ocean-100 text-ocean-800',
    gold: 'bg-gold-300/40 text-gold-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', colors[color], className)}>
      {children}
    </span>
  );
}

// ========================================
// Stat: بطاقة إحصائية (رقم كبير + وصف)
// ========================================

export function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card hover className="flex items-center gap-4">
      {/* أيقونة بتدرج أزرق */}
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean-500 to-ocean-700 text-white">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="truncate text-2xl font-extrabold text-ocean-900">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </Card>
  );
}

// ========================================
// ProgressBar: شريط تقدم أفقي
// ========================================

export function ProgressBar({
  value,
  color = 'ocean',
  className,
  label,
}: {
  value: number;
  color?: 'ocean' | 'gold' | 'green' | 'red';
  className?: string;
  label?: string;
}) {
  // نضغط القيمة بين 0 و100 حتى لا يكسر الشريط.
  const v = Math.min(100, Math.max(0, value));
  const colors = {
    ocean: 'bg-ocean-500',
    gold: 'bg-gold-500',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>{label}</span><span>{Math.round(v)}%</span></div>}
      <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-slate-200', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-500', colors[color])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

// ========================================
// ProgressRing: دائرة تقدم (SVG)
// ========================================

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color = '#1d84bc',
  children,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  // نضغط القيمة بين 0 و100.
  const v = Math.min(100, Math.max(0, value));
  // حساب نصف القطر والمحيط لإخفاء الجزء غير المكتمل من الدائرة.
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* حلقة الخلفية الرمادية */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          {/* الحلقة الملونة — تظهر بقدر النسبة المئوية */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        {/* النسبة المئوية في المنتصف */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-ocean-900">{Math.round(v)}%</span>
        </div>
      </div>
      {label && <span className="text-xs font-semibold text-slate-500">{label}</span>}
      {children}
    </div>
  );
}

// ========================================
// Modal: نافذة منبثقة
// ========================================

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  // إن كانت مغلقة لا نرسم شيئًا.
  if (!open) return null;
  // عرض النافذة حسب الحجم المطلوب.
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* خلفية معتمة — النقر عليها يغلق النافذة */}
      <div className="absolute inset-0 bg-ocean-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg', sizes[size])}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ocean-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ========================================
// Spinner: مؤشر تحميل
// ========================================

export function Spinner({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ocean-600">
      <svg className="h-10 w-10 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}

// ========================================
// EmptyState: حالة فارغة (لا توجد بيانات)
// ========================================

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      {icon && <div className="text-ocean-300">{icon}</div>}
      <h3 className="text-lg font-bold text-ocean-900">{title}</h3>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}
