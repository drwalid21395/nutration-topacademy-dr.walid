'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Alert } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }

    const callback = params.get('callbackUrl');
    router.push(callback && callback.startsWith('/') ? callback : '/dashboard');
    router.refresh();
  }

  return (
    <>
      {params.get('registered') === '1' && (
        <div className="mb-4">
          <Alert variant="success" title="تم إنشاء الحساب بنجاح">يمكنك الآن تسجيل الدخول.</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert variant="danger" title="فشل تسجيل الدخول">{error}</Alert>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="البريد الإلكتروني" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="email"
              dir="ltr"
              className="pr-10 text-left"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </Field>
        <Field label="كلمة المرور" required>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type={show ? 'text' : 'password'}
              dir="ltr"
              className="pr-10 text-left"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="إظهار كلمة المرور"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />
            تذكرني
          </label>
          <Link href="/forgot-password" className="font-semibold text-ocean-600 hover:text-ocean-700">
            نسيت كلمة المرور؟
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          تسجيل الدخول
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-ocean-600 hover:text-ocean-700">
          إنشاء حساب جديد
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout title="تسجيل الدخول" subtitle="مرحبًا بعودتك! سجّل دخولك لمتابعة خطتك.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
