'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Menu, X, LogIn, UserPlus, LayoutDashboard, Bell, LogOut } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/supplements', label: 'المكملات' },
  { href: '/supplements/calculator', label: 'حاسبة المكملات' },
  { href: '/competition-mode', label: 'وضع البطولة' },
  { href: '/about', label: 'من نحن' },
  { href: '/contact', label: 'تواصل معنا' },
];

export function Navbar({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all',
        scrolled ? 'bg-white/90 shadow-sm backdrop-blur-lg' : 'bg-white/60 backdrop-blur'
      )}
    >
      <nav className="container-app flex h-16 items-center justify-between gap-4">
        <Logo variant="dark" />

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                pathname === l.href ? 'bg-ocean-50 text-ocean-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ocean-700'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

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

        <button
          className="rounded-lg p-2 text-ocean-900 hover:bg-ocean-50 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="القائمة"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-lg lg:hidden">
          <div className="flex flex-col gap-1">
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
