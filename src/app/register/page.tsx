'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Alert } from '@/components/ui';
import { ROLES, type RoleKey } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ROLE_CARDS: { key: RoleKey; desc: string }[] = [
  { key: 'athlete', desc: 'أنا السباح' },
  { key: 'guardian', desc: 'أتابع سباحًا قاصرًا' },
  { key: 'coach', desc: 'أدير سباحين' },
  { key: 'dietitian', desc: 'اختصاصي تغذية' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'athlete' as RoleKey,
    isMinor: false,
    parentName: '',
    parentPhone: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
        isAdult: !form.isMinor,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        acceptTerms: form.acceptTerms,
        acceptPrivacy: form.acceptPrivacy,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'حدث خطأ أثناء إنشاء الحساب');
      setLoading(false);
      return;
    }

    await signIn('credentials', { email: form.email, password: form.password, redirect: false });
    router.push('/dashboard?registered=1');
    router.refresh();
  }

  return (
    <AuthLayout
      title="إنشاء حساب جديد"
      subtitle="انضم إلى Top Academy وابدأ رحلة تغذية سباحك"
    >
      {error && (
        <div className="mb-4">
          <Alert variant="danger" title="تعذر إنشاء الحساب">{error}</Alert>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <span className="label">نوع الحساب</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_CARDS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => set('role', r.key)}
                className={cn(
                  'rounded-xl border-2 px-3 py-2.5 text-right transition-all',
                  form.role === r.key
                    ? 'border-ocean-500 bg-ocean-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-ocean-200'
                )}
              >
                <span className="block text-sm font-bold text-slate-800">{ROLES[r.key]}</span>
                <span className="block text-xs text-slate-500">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="الاسم الكامل" required>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pr-10" placeholder="الاسم كما سيظهر في التقارير" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="البريد الإلكتروني" required>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input type="email" dir="ltr" className="pr-10 text-left" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
          </Field>
          <Field label="رقم الهاتف">
            <div className="relative">
              <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input dir="ltr" className="pr-10 text-left" placeholder="+20 100 000 0000" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </Field>
        </div>

        <Field label="كلمة المرور" hint="8 أحرف على الأقل مع حرف ورقم" required>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type={show ? 'text' : 'password'} dir="ltr" className="pr-10 text-left" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="إظهار كلمة المرور">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={form.isMinor} onChange={(e) => set('isMinor', e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-ocean-600" />
            <span>
              <span className="font-bold text-slate-800">حساب لسباح قاصر (أقل من 18 عامًا)</span>
              <span className="block text-xs text-slate-500">سيلزم إدخال بيانات ولي الأمر وموافقته</span>
            </span>
          </label>
          {form.isMinor && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input placeholder="اسم ولي الأمر" value={form.parentName} onChange={(e) => set('parentName', e.target.value)} />
              <Input dir="ltr" className="text-left" placeholder="هاتف ولي الأمر" value={form.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ocean-600" required />
            <span>أوافق على <Link href="/terms" className="font-bold text-ocean-600 hover:underline" target="_blank">شروط الاستخدام</Link></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={form.acceptPrivacy} onChange={(e) => set('acceptPrivacy', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ocean-600" required />
            <span>أوافق على <Link href="/privacy" className="font-bold text-ocean-600 hover:underline" target="_blank">سياسة الخصوصية</Link> وحفظ بياناتي الصحية</span>
          </label>
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          إنشاء الحساب
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-bold text-ocean-600 hover:text-ocean-700">تسجيل الدخول</Link>
      </p>
    </AuthLayout>
  );
}
