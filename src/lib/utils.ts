import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** حساب العمر من تاريخ الميلاد */
export function calculateAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/** تنسيق رقم عربي */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('ar-EG', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

/** تنسيق تاريخ عربي */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** تنسيق تاريخ عربي مختصر للجوال */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

/** نسبة آمنة 0-100 */
export function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** إنشاء معرّف قصير */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** إرجاع التاريخ الحالي بداية اليوم */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
