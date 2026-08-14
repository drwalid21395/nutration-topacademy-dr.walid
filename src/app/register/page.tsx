/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/register/page.tsx

وظيفة الملف:
صفحة "إنشاء حساب جديد" (المسار /register). نموذج كامل:
اختيار الدور (سباح/ولي/مدرب/اختصاصي)، الاسم والبريد
والهاتف وكلمة المرور، خيار حساب قاصر (بيانات ولي الأمر)،
والموافقة على الشروط والخصوصية. ثم تُرسل البيانات لواجهة
API ويُسجل الدخول تلقائيًا.

لماذا نحتاجه؟
بوابة التسجيل الأولى — بدونها لا يستطيع الزائر إنشاء حساب.

نوعها: Client Component ('use client').
تعمل في المتصفح: form مع حالة useState وإرسال fetch
وتسجيل دخول بعد النجاح.

متى يعمل؟
عند فتح /register (من زر "إنشاء حساب" أو زر "ابدأ رحلتك").

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- AuthLayout من components/auth/auth-layout.
- مكونات UI (Button, Input, Field, Alert).
- signIn من next-auth/react (تسجيل الدخول بعد الإنشاء).
- ROLES و RoleKey من lib/constants و cn من lib/utils.
- واجهة API /api/auth/register.

ترتيب العمل:
1. يملأ المستخدم النموذج (حالة form تحفظ القيم).
2. عند الإرسال: نتحقق من الموافقة على الشروط والخصوصية.
3. نرسل البيانات (POST) لواجهة التسجيل.
4. عند النجاح: signIn ثم انتقال للوحة التحكم.
==================================================
*/

// ========================================
// 1. التوجيه
// ========================================

'use client';

// ========================================
// 2. الاستيرادات
// ========================================

import { useState } from 'react'; // useState: حفظ حالة النموذج — من مكتبة react.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { useRouter } from 'next/navigation'; // useRouter: التنقل البرمجي بين الصفحات.
import { signIn } from 'next-auth/react'; // دالة تسجيل الدخول — من مكتبة next-auth الخارجية.
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { AuthLayout } from '@/components/auth/auth-layout'; // إطار صفحة المصادقة — ملف محلي.
import { Button } from '@/components/ui/button'; // زر جاهز — ملف محلي.
import { Input, Field } from '@/components/ui/forms'; // حقل إدخال + غلاف بعنوان — ملف محلي.
import { Alert } from '@/components/ui'; // تنبيه جاهز — ملف محلي.
import { ROLES, type RoleKey } from '@/lib/constants'; // أسماء الأدوار العربية + النوع — ملف محلي.
import { cn } from '@/lib/utils'; // دالة دمج أسماء الفئات — ملف محلي.

// ========================================
// 3. الثوابت (خيارات الأدوار)
// ========================================

// ROLE_CARDS: مصفوفة (Array) بطاقات الأدوار الأربعة.
// key: نوع الدور (RoleKey)، desc: وصف بسيط للزائر.
const ROLE_CARDS: { key: RoleKey; desc: string }[] = [
  { key: 'athlete', desc: 'أنا السباح' },
  { key: 'guardian', desc: 'أتابع سباحًا قاصرًا' },
  { key: 'coach', desc: 'أدير سباحين' },
  { key: 'dietitian', desc: 'اختصاصي تغذية' },
];

// ========================================
// 4. الصفحة الرئيسية (تعمل في المتصفح)
// ========================================

// RegisterPage: الصفحة الرئيسية (Client).
export default function RegisterPage() {
  const router = useRouter(); // أداة التنقل.
  // form: حالة كائن تحفظ كل قيم النموذج دفعة واحدة.
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'athlete' as RoleKey, // الدور الافتراضي: سباح.
    isMinor: false, // هل الحساب لقاصر؟
    parentName: '', // بيانات ولي الأمر (تُظهر لو قاصر).
    parentPhone: '',
    acceptTerms: false, // الموافقة على الشروط.
    acceptPrivacy: false, // الموافقة على الخصوصية.
  });
  const [show, setShow] = useState(false); // إظهار/إخفاء كلمة المرور.
  const [error, setError] = useState<string | null>(null); // رسالة الخطأ.
  const [loading, setLoading] = useState(false); // هل الإرسال جارٍ؟

  // set: دالة مساعدة لتحديث حقل واحد من النموذج.
  // k: اسم الحقل، v: القيمة الجديدة. ننسخ النموذج القديم ونغير الحقل فقط
  // (الانتشار {...f} ينسخ باقي الحقول كما هي).
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // onSubmit: دالة الإرسال عند الضغط على "إنشاء الحساب".
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // منع إعادة تحميل الصفحة الافتراضية.
    setLoading(true); // نبدأ الإرسال.
    setError(null); // نمسح أخطاء سابقة.

    // الشرط: يجب الموافقة على الشروط والخصوصية قبل المتابعة.
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة');
      setLoading(false);
      return;
    }

    // نرسل البيانات لواجهة API الخاصة بالتسجيل (POST).
    // fetch: طلب إلى الخادم. نحول البيانات لـ JSON في body.
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
        isAdult: !form.isMinor, // نحول "قاصر" إلى "بالغ" بعكس القيمة.
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        acceptTerms: form.acceptTerms,
        acceptPrivacy: form.acceptPrivacy,
      }),
    });

    const data = await res.json(); // نقرأ رد الخادم.
    if (!res.ok) {
      // لو فشل التسجيل: نعرض رسالة الخادم (مثل بريد موجود).
      setError(data.error ?? 'حدث خطأ أثناء إنشاء الحساب');
      setLoading(false);
      return;
    }

    // النجاح: نسجل الدخول مباشرة ببياناته (redirect: false =
    // لا تنتقل تلقائيًا، سننتقل نحن بعدها).
    await signIn('credentials', { email: form.email, password: form.password, redirect: false });
    // ننتقل للوحة التحكم مع علامة ?registered=1 (لرسالة ترحيب).
    router.push('/dashboard?registered=1');
    router.refresh(); // نحدّث بيانات الجلسة فورًا في الصفحات.
  }

  // ========================================
  // 5. عرض الواجهة (JSX)
  // ========================================
  return (
    <AuthLayout
      title="إنشاء حساب جديد"
      subtitle="انضم إلى Top Academy وابدأ رحلة تغذية سباحك"
    >
      {/* رسالة الخطأ (إن وجدت) */}
      {error && (
        <div className="mb-4">
          <Alert variant="danger" title="تعذر إنشاء الحساب">{error}</Alert>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        {/* بطاقات اختيار الدور: map على ROLE_CARDS.
            عند النقر نضبط form.role، ويتحول إطار المختار للأزرق. */}
        <div>
          <span className="label">نوع الحساب</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_CARDS.map((r) => (
              <button
                key={r.key}
                type="button" // type=button: حتى لا يُرسل النموذج عند النقر.
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

        {/* حقل الاسم الكامل (إلزامي) */}
        <Field label="الاسم الكامل" required>
          <div className="relative">
            <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pr-10" placeholder="الاسم كما سيظهر في التقارير" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
        </Field>

        {/* البريد والهاتف في صف واحد (شبكة عمودين) */}
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

        {/* حقل كلمة المرور مع زر إظهار/إخفاء (تبديل show) */}
        <Field label="كلمة المرور" hint="8 أحرف على الأقل مع حرف ورقم" required>
          <div className="relative">
            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type={show ? 'text' : 'password'} dir="ltr" className="pr-10 text-left" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="إظهار كلمة المرور">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {/* خيار "حساب قاصر": لو مفعّل تظهر حقول ولي الأمر (شرط). */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={form.isMinor} onChange={(e) => set('isMinor', e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-ocean-600" />
            <span>
              <span className="font-bold text-slate-800">حساب لسباح قاصر (أقل من 18 عامًا)</span>
              <span className="block text-xs text-slate-500">سيلزم إدخال بيانات ولي الأمر وموافقته</span>
            </span>
          </label>
          {/* حقول ولي الأمر: تظهر فقط لو isMinor صحيح. */}
          {form.isMinor && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input placeholder="اسم ولي الأمر" value={form.parentName} onChange={(e) => set('parentName', e.target.value)} />
              <Input dir="ltr" className="text-left" placeholder="هاتف ولي الأمر" value={form.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} />
            </div>
          )}
        </div>

        {/* خانات الموافقة على الشروط والخصوصية (روابط تفتح في تبويب جديد). */}
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

        {/* زر الإرسال الرئيسي (loading يعرض دورانًا أثناء الطلب). */}
        <Button type="submit" className="w-full" loading={loading}>
          إنشاء الحساب
        </Button>
      </form>
      {/* رابط العودة لتسجيل الدخول لمن لديه حساب. */}
      <p className="mt-6 text-center text-sm text-slate-500">
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-bold text-ocean-600 hover:text-ocean-700">تسجيل الدخول</Link>
      </p>
    </AuthLayout>
  );
}
