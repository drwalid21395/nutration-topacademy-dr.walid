/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/reset-password/page.tsx

وظيفة الملف:
صفحة "تعيين كلمة مرور جديدة" (المسار /reset-password).
يصل إليها المستخدم عبر الرابط المرسل في بريده (يحمل
رمز token). يُدخل كلمته الجديدة وتأكيدها، فتُرسل لواجهة
API، وعند النجاح تظهر شاشة تأكيد.

لماذا نحتاجه؟
تكمل رحلة استعادة الحساب بعد صفحة "نسيت كلمة المرور":
هنا تُكتب كلمة المرور الجديدة فعليًا.

نوعها: Client Component ('use client').
تعمل في المتصفح: useState + useSearchParams (قراءة الرمز
من الرابط) + fetch.

متى يعمل؟
عند فتح /reset-password?token=<رمز> (من الرابط في البريد).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- AuthLayout من components/auth/auth-layout.
- مكونات UI (Button, Input, Field, Alert).
- واجهة API /api/auth/reset-password.

ترتيب العمل:
1. قراءة token من الرابط.
2. إدخال كلمة المرور وتأكيدها (نتحقق من تطابقهما).
3. إرسال (POST) لواجهة إعادة التعيين.
4. النجاح → شاشة "تم التغيير" مع زر تسجيل الدخول.
==================================================
*/

// ========================================
// 1. التوجيه
// ========================================

'use client';

// ========================================
// 2. الاستيرادات
// ========================================

import { useState, Suspense } from 'react'; // useState: حفظ الحالة. Suspense: غلاف تحميل — من مكتبة react.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { useRouter, useSearchParams } from 'next/navigation'; // useRouter: التنقل. useSearchParams: قراءة معلمات الرابط.
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { AuthLayout } from '@/components/auth/auth-layout'; // إطار صفحة المصادقة — ملف محلي.
import { Button } from '@/components/ui/button'; // زر جاهز — ملف محلي.
import { Input, Field } from '@/components/ui/forms'; // حقل إدخال + غلاف بعنوان — ملف محلي.
import { Alert } from '@/components/ui'; // تنبيه جاهز — ملف محلي.

// ========================================
// 3. مكون النموذج (يعمل في المتصفح)
// ========================================

// ResetForm: مكون النموذج. نغلفه في Suspense لأننا نستخدم
// useSearchParams (قراءة الرابط) — Next.js يطلب ذلك في بعض الأوضاع.
function ResetForm() {
  const router = useRouter(); // للتنقل بعد النجاح.
  const params = useSearchParams(); // معلمات الرابط.
  const token = params.get('token') ?? ''; // رمز إعادة التعيين من الرابط (أو فارغ).
  // حالات الشاشة:
  const [password, setPassword] = useState(''); // كلمة المرور الجديدة.
  const [confirm, setConfirm] = useState(''); // تأكيدها.
  const [show, setShow] = useState(false); // إظهار/إخفاء كلمة المرور.
  const [done, setDone] = useState(false); // هل اكتملت العملية بنجاح؟
  const [error, setError] = useState<string | null>(null); // رسالة الخطأ.
  const [loading, setLoading] = useState(false); // هل الإرسال جارٍ؟

  // onSubmit: دالة الإرسال.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // منع إعادة تحميل الصفحة.
    // نتحقق أولًا: كلمتا المرور متطابقتان؟
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    setError(null);
    // نرسل الرمز وكلمة المرور لواجهة إعادة التعيين.
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json(); // نقرأ رد الخادم.
    if (!res.ok) {
      // لو فشل: نعرض رسالة الخطأ.
      setError(data.error ?? 'تعذر إعادة التعيين');
      setLoading(false);
      return;
    }
    setDone(true); // النجاح: نعرض شاشة التأكيد.
  }

  // شاشة النجاح: بدل النموذج نعرض علامة تأكيد وزر "تسجيل الدخول".
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
    // النموذج: عند الإرسال → dالة onSubmit.
    <form onSubmit={onSubmit} className="space-y-4">
      {/* رسالة الخطأ (إن وجدت) */}
      {error && (
        <Alert variant="danger" title="خطأ">{error}</Alert>
      )}
      <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل مع حرف ورقم" required>
        <div className="relative">
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input type={show ? 'text' : 'password'} dir="ltr" className="pr-10 text-left" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {/* زر إظهار/إخفاء كلمة المرور */}
          <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="إظهار كلمة المرور">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="تأكيد كلمة المرور" required>
        <Input type={show ? 'text' : 'password'} dir="ltr" className="text-left" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>حفظ كلمة المرور الجديدة</Button>
      {/* رابط العودة لتسجيل الدخول. */}
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="inline-flex items-center gap-1 font-bold text-ocean-600 hover:text-ocean-700">
          <ArrowRight className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </p>
    </form>
  );
}

// ========================================
// 4. الصفحة الرئيسية (المكوّن الافتراضي)
// ========================================

// ResetPasswordPage: الصفحة نفسها — إطار AuthLayout مع العنوان
// ولف النموذج داخل Suspense (لا يظهر شيء أثناء التحضير).
export default function ResetPasswordPage() {
  return (
    <AuthLayout title="تعيين كلمة مرور جديدة" subtitle="أدخل كلمة المرور الجديدة لحسابك.">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
