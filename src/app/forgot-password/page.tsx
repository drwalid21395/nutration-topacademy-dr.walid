/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/forgot-password/page.tsx

وظيفة الملف:
صفحة "استعادة كلمة المرور" (المسار /forgot-password).
يعبئ المستخدم بريده، فيُرسل طلبًا لواجهة API ترسل له
رابط إعادة التعيين، ونعرض رسالة التأكيد (ورابط التطوير
في بيئة التطوير فقط).

لماذا نحتاجه؟
بدونها لا يستطيع المستخدم المنسي لكلمته العودة لحسابه.

نوعها: Client Component ('use client').
تعمل في المتصفح لأنها تستخدم useState و fetch و
معالجات الأحداث — أشياء لا تعمل في الخادم.

متى يعمل؟
عند فتح /forgot-password (من رابط "نسيت كلمة المرور؟"
في صفحة الدخول).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- AuthLayout من components/auth/auth-layout (إطار الصفحة).
- مكونات UI (Button, Input, Field, Alert).
- واجهة API /api/auth/forgot-password (خارج الملف).

ترتيب العمل:
1. إرسال البريد عبر fetch (POST) لواجهة API.
2. عرض الرسالة القادمة (نجاح/خطأ).
3. لو رجع رابط تطوير نعرضه (يظهر فقط في التطوير).
==================================================
*/

// ========================================
// 1. التوجيه والتوجيهات
// ========================================

'use client';

// ========================================
// 2. الاستيرادات
// ========================================

import { useState, Suspense } from 'react'; // useState: حفظ الحالة. Suspense: غلاف للتحميل البطيء — من مكتبة react الخارجية.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { Mail, KeyRound, ArrowRight } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { AuthLayout } from '@/components/auth/auth-layout'; // إطار صفحة المصادقة — ملف محلي.
import { Button } from '@/components/ui/button'; // زر جاهز — ملف محلي.
import { Input, Field } from '@/components/ui/forms'; // حقل إدخال + غلاف حقل بعنوان — ملف محلي.
import { Alert } from '@/components/ui'; // تنبيه جاهز — ملف محلي.

// ========================================
// 3. مكون النموذج (يعمل في المتصفح)
// ========================================

// ForgotForm: مكون النموذج. نغلفه في Suspense تحسبًا لأي
// قراءة لمتغيرات الرابط لاحقًا.
function ForgotForm() {
  // حالات (useState) نحفظ فيها قيم الشاشة:
  const [email, setEmail] = useState(''); // البريد الذي يكتبه المستخدم.
  const [message, setMessage] = useState<string | null>(null); // رسالة النتيجة (نجاح/خطأ).
  const [devLink, setDevLink] = useState<string | null>(null); // رابط التطوير (فارغ في الإنتاج).
  const [loading, setLoading] = useState(false); // هل الطلب جارٍ الآن؟ (لعرض "جارٍ..." وتثبيت الزر)

  // onSubmit: دالة تُستدعى عند ضغط زر الإرسال.
  // async/await: ننتظر رد الخادم ولا نكمل قبله.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // منع السلوك الافتراضي (إعادة تحميل الصفحة) — نتعامل مع الطلب يدويًا.
    setLoading(true); // نبدأ التحميل.
    // fetch: إرسال طلب إلى واجهة API داخل المشروع (نفس الخادم).
    // نحول البريد لكائن JSON ثم نرسله بـ method: POST.
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json(); // قراءة رد الخادم كنص JSON.
    setMessage(data.message ?? 'تم إرسال رابط إعادة التعيين'); // عرض رسالة الخادم أو رسالة افتراضية.
    if (data.devResetUrl) setDevLink(data.devResetUrl); // لو الخادم أرسل رابط تطوير نحفظه للعرض.
    setLoading(false); // انتهى التحميل.
  }

  return (
    <>
      {/* عرض رسالة النتيجة (إن وجدت) */}
      {message && (
        <div className="mb-4">
          <Alert variant="success" title="تمت المعالجة">{message}</Alert>
          {/* رابط التطوير: يظهر فقط حين يعيده الخادم في بيئة التطوير، ولن يظهر في الإنتاج. */}
          {devLink && (
            <div className="mt-3 rounded-lg border border-ocean-200 bg-ocean-50 p-3 text-xs text-ocean-800" dir="ltr">
              <p className="font-bold mb-1">رابط التطوير (لن يظهر في الإنتاج):</p>
              <a href={devLink} className="break-all underline">{devLink}</a>
            </div>
          )}
        </div>
      )}
      {/* النموذج: عند الإرسال → دالة onSubmit. value/onChange يربطان الحقل بالحالة. */}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="البريد الإلكتروني" hint="سنرسل لك رابطًا لاستعادة كلمة المرور">
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input type="email" dir="ltr" className="pr-10 text-left" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </Field>
        {/* loading: يعرض دورانًا ويمنع الضغط المتكرر أثناء الطلب. */}
        <Button type="submit" className="w-full" loading={loading}>
          <KeyRound className="h-4 w-4" />
          إرسال رابط الاستعادة
        </Button>
      </form>
      {/* رابط العودة لتسجيل الدخول. */}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="inline-flex items-center gap-1 font-bold text-ocean-600 hover:text-ocean-700">
          <ArrowRight className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </p>
    </>
  );
}

// ========================================
// 4. الصفحة الرئيسية (المكوّن الافتراضي)
// ========================================

// ForgotPasswordPage: الصفحة نفسها — إطار AuthLayout مع العنوان
// ولف النموذج داخل Suspense (لا يظهر شيء أثناء تحميله).
export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="استعادة كلمة المرور" subtitle="أدخل بريدك وسنرسل لك رابط إعادة التعيين.">
      <Suspense fallback={null}>
        <ForgotForm />
      </Suspense>
    </AuthLayout>
  );
}
