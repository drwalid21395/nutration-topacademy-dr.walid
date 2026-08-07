'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Alert } from '@/components/ui';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر إعادة التعيين');
      setLoading(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="text-xl font-black text-ocean-900">تم تغيير كلمة المرور بنجاح</h2>
        <Button onClick={() => router.push('/login')} className="w-full">تسجيل الدخول الآن</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <Alert variant="danger" title="خطأ">{error}</Alert>
      )}
      <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل مع حرف ورقم" required>
        <div className="relative">
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input type={show ? 'text' : 'password'} dir="ltr" className="pr-10 text-left" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="إظهار كلمة المرور">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="تأكيد كلمة المرور" required>
        <Input type={show ? 'text' : 'password'} dir="ltr" className="text-left" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>حفظ كلمة المرور الجديدة</Button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="inline-flex items-center gap-1 font-bold text-ocean-600 hover:text-ocean-700">
          <ArrowRight className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="تعيين كلمة مرور جديدة" subtitle="أدخل كلمة المرور الجديدة لحسابك.">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
