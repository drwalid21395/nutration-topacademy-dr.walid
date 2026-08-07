'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Mail, KeyRound, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Alert } from '@/components/ui';

function ForgotForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setMessage(data.message ?? 'تم إرسال رابط إعادة التعيين');
    if (data.devResetUrl) setDevLink(data.devResetUrl);
    setLoading(false);
  }

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert variant="success" title="تمت المعالجة">{message}</Alert>
          {devLink && (
            <div className="mt-3 rounded-lg border border-ocean-200 bg-ocean-50 p-3 text-xs text-ocean-800" dir="ltr">
              <p className="font-bold mb-1">رابط التطوير (لن يظهر في الإنتاج):</p>
              <a href={devLink} className="break-all underline">{devLink}</a>
            </div>
          )}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="البريد الإلكتروني" hint="سنرسل لك رابطًا لاستعادة كلمة المرور">
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type="email" dir="ltr" className="pr-10 text-left" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          <KeyRound className="h-4 w-4" />
          إرسال رابط الاستعادة
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="inline-flex items-center gap-1 font-bold text-ocean-600 hover:text-ocean-700">
          <ArrowRight className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="استعادة كلمة المرور" subtitle="أدخل بريدك وسنرسل لك رابط إعادة التعيين.">
      <Suspense fallback={null}>
        <ForgotForm />
      </Suspense>
    </AuthLayout>
  );
}
