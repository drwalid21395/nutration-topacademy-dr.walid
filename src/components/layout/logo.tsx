import Link from 'next/link';
import { Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/constants';

/**
 * الشعار النصي لـ TOP ACADEMY.
 * قابل للاستبدال بشعار صورة عبر خاصية logoImageUrl من لوحة الإدارة.
 */
export function Logo({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const dark = variant === 'dark';
  return (
    <Link href="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Top Academy">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105',
          dark ? 'bg-gradient-to-br from-ocean-500 to-ocean-800' : 'bg-gradient-to-br from-ocean-300 to-ocean-600'
        )}
      >
        <Waves className="h-6 w-6 text-white" />
      </div>
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
