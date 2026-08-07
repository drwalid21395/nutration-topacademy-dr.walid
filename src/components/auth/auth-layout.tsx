import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { Waves } from 'lucide-react';
import { BRAND } from '@/lib/constants';

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
      {/* الجانب البصري */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-hero-waves p-10 text-white lg:flex">
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

      {/* نموذج */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h1 className="text-2xl font-black text-ocean-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
