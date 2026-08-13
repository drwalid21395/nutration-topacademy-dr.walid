/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/login/page.tsx

وظيفة الملف:
صفحة تسجيل الدخول (المسار /login).
تحتوي نموذج: بريد + كلمة مرور + إظهار/إخفاء كلمة المرور
+ تنبيهات الأخطاء + روابط (نسيت كلمة المرور / إنشاء حساب).

لماذا نحتاجه؟
هذه بوابة الدخول — بدونها لا يمكن للمستخدم الدخول إلى
لوحة التحكم والخدمات المحمية.

'use client':
يعمل في المتصفح لأنه يحتاج useState (نص الحقول)
وuseRouter (التنقل بعد النجاح) وsignIn (إرسال للخادم).

متى تعمل؟
عند فتح /login أو عندما يحوّلنا NextAuth تلقائيًا إليها
لأننا في authOptions (pages: { signIn: '/login' }).

ترتيب التنفيذ:
1. المستخدم يكتب البريد وكلمة المرور.
2. يضغط "تسجيل الدخول" → onSubmit.
3. نستدعي signIn('credentials', {email, password, redirect: false}).
4. NextAuth يفحص البيانات في src/lib/auth.ts.
5. لو خطأ → نعرض رسالة. لو نجاح → ننتقل لـ dashboard.

العلاقة مع الملفات:
- AuthLayout: إطار الصفحة (شعار + تنسيق).
- Button/Input/Field/Alert من components/ui.
- signIn من next-auth (مكتبة خارجية).
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Alert } from '@/components/ui';

// ========================================
// 2. نموذج الدخول (المكون الداخلي)
// ========================================

/*
-----------------------------------------
المكوّن: LoginForm
-----------------------------------------
وظيفته: النموذج نفسه وحالة الإرسال.

State (حالة داخل المكون — تتغير مع استخدام المستخدم):
- email, password: ما يكتبه المستخدم.
- show: هل نعرض كلمة المرور كنص عادي؟
- error: رسالة الخطأ الحالية (null = لا خطأ).
- loading: هل الطلب قيد الإرسال؟ (لتعطيل الزر).

ترتيب التنفيذ (onSubmit):
1. e.preventDefault(): نمنع المتصفح من إعادة تحميل الصفحة.
2. setLoading(true): نبدأ التحميل.
3. signIn(...): نرسل البريد وكلمة المرور لـ NextAuth.
4. لو res.error → نعرض رسالة ونوقف.
5. لو نجاح → ننتقل لصفحة callbackUrl أو dashboard.
-----------------------------------------
*/
function LoginForm() {
  const router = useRouter(); // للتنقل بين الصفحات برمجيًا
  const params = useSearchParams(); // لقراءة معاملات الرابط (مثل ?registered=1)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // async: دالة غير متزامنة — يمكنها استخدام await للانتظار.
  // e: كائن الحدث (Event) — هنا "إرسال النموذج".
  async function onSubmit(e: React.FormEvent) {
    // نمنع السلوك الافتراضي (إعادة تحميل الصفحة) لنبقى في التطبيق.
    e.preventDefault();
    setLoading(true);
    setError(null);

    // signIn: ترسل البيانات لواجهة NextAuth في الخادم.
    // redirect: false = لا تقم بالتحويل بنفسك؛ سنتعامل مع النتيجة يدويًا.
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    // لو يوجد خطأ (بريد/كلمة خاطئة) → نعرض رسالة ونعود.
    if (res?.error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      setLoading(false);
      return;
    }

    // النجاح: نقرأ callbackUrl إن وجد (مثال: أردنا فتح /dashboard قبل الدخول)
    // ونضمن أنه رابط داخلي يبدأ بـ '/' (حتى لا يقفز لموقع خارجي — أمان).
    const callback = params.get('callbackUrl');
    router.push(callback && callback.startsWith('/') ? callback : '/dashboard');
    // router.refresh(): يحدّث مكونات الخادم (جلسة الدخول الجديدة).
    router.refresh();
  }

  return (
    <>
      {/* لو وصلنا من صفحة التسجيل الناجح (?registered=1) → رسالة نجاح. */}
      {params.get('registered') === '1' && (
        <div className="mb-4">
          <Alert variant="success" title="تم إنشاء الحساب بنجاح">يمكنك الآن تسجيل الدخول.</Alert>
        </div>
      )}
      {/* رسالة الخطأ إن وجدت. */}
      {error && (
        <div className="mb-4">
          <Alert variant="danger" title="فشل تسجيل الدخول">{error}</Alert>
        </div>
      )}

      {/* النموذج — عند الإرسال يعمل onSubmit. */}
      <form onSubmit={onSubmit} className="space-y-4">
        {/* حقل البريد: Field تعرض التسمية، Input هي الحقل نفسه. */}
        <Field label="البريد الإلكتروني" required>
          <div className="relative">
            {/* أيقونة داخل الحقل (موجودة في الخلفية، لا تلتقط نقرًا). */}
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            {/* dir="ltr": نعرض البريد من اليسار حتى وسط عربي. */}
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

        {/* حقل كلمة المرور + زر إظهار/إخفاء. */}
        <Field label="كلمة المرور" required>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            {/* type يتغير: password (نقاط) أو text (نص ظاهر) حسب show. */}
            <Input
              type={show ? 'text' : 'password'}
              dir="ltr"
              className="pr-10 text-left"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {/* زر عين — يبدّل show. */}
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

        {/* صف: "تذكرني" + رابط نسيت كلمة المرور. */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />
            تذكرني
          </label>
          <Link href="/forgot-password" className="font-semibold text-ocean-600 hover:text-ocean-700">
            نسيت كلمة المرور؟
          </Link>
        </div>

        {/* زر الإرسال — loading يعطل الزر ويعرض مؤشرًا أثناء الطلب. */}
        <Button type="submit" className="w-full" loading={loading}>
          تسجيل الدخول
        </Button>
      </form>

      {/* رابط للتسجيل لو لا يملك حسابًا. */}
      <p className="mt-6 text-center text-sm text-slate-500">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-bold text-ocean-600 hover:text-ocean-700">
          إنشاء حساب جديد
        </Link>
      </p>
    </>
  );
}

// ========================================
// 3. الصفحة الرئيسية
// ========================================

/*
-----------------------------------------
الدالة: LoginPage
-----------------------------------------
وظيفتها: عرض صفحة الدخول كاملة داخل إطار AuthLayout.
لماذا Suspense؟
useSearchParams في Next.js 15 يتطلب التغليف بـ Suspense
أثناء التصيير الثابت (Static Rendering) — وإلا يعطي خطأ.
fallback={null}: نعرض لا شيء أثناء انتظار تجهيز المعاملات.
يتم استدعاؤها من: Next.js تلقائيًا عند فتح /login.
-----------------------------------------
*/
export default function LoginPage() {
  return (
    <AuthLayout title="تسجيل الدخول" subtitle="مرحبًا بعودتك! سجّل دخولك لمتابعة خطتك.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
