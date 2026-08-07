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
  const dark = variant === 'dark';
  return (
    <Link href="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Top Academy">
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
