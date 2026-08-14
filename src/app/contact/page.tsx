/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/contact/page.tsx

وظيفة الملف:
صفحة "تواصل معنا" (المسار /contact) — صفحة تعريفية
ثابتة تعرض وسائل التواصل: واتساب، البريد، الرد السريع،
ساعات الدعم، وتنبيهًا بضرورة استشارة الطبيب.

لماذا نحتاجه؟
ليجد الزائر/المستخدم قنوات التواصل الرسمية دون الحاجة
لبيانات من قاعدة البيانات.

نوعها: Server Component (بدون 'use client').
تعمل في الخادم فقط لمعرفة حالة تسجيل الدخول لعرض القائمة
العلوية المناسبة.

متى يعمل؟
عند فتح /contact من القائمة أو رابط في التذييل.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا لأي زيارة لمسار /contact.

الملفات التي يتعامل معها:
- Navbar من components/layout/navbar و Footer من components/layout/footer.
- getCurrentUser من lib/auth.
- CONTACT من lib/constants (رقم واتساب ورابطه).

ترتيب العمل:
1. معرفة من هو المستخدم (لشكل القائمة العلوية).
2. عرض الشريط العلوي ثم بطاقات التواصل الأربع.
3. عرض تنبيه الاستشارة الطبية ثم التذييل.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { Mail, MessageSquare, Clock, ShieldCheck, MessageCircle } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { Navbar } from '@/components/layout/navbar'; // الشريط العلوي — ملف محلي.
import { Footer } from '@/components/layout/footer'; // التذييل — ملف محلي.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { CONTACT } from '@/lib/constants'; // ثوابت التواصل (رابط ورقم واتساب) — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'تواصل معنا' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// ContactPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function ContactPage() {
  // المستخدم الحالي (قد يكون null) — فقط لاختيار شكل القائمة العلوية.
  const user = await getCurrentUser();

  return (
    <>
      {/* الشريط العلوي: مسجل → لوحة التحكم، زائر → تسجيل الدخول. */}
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg">
        <section className="container-app py-16">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h1 className="text-3xl font-black text-ocean-900">تواصل معنا</h1>
              <p className="mt-3 text-slate-600">نسعد بأسئلتك وملاحظاتك حول المنصة أو المحتوى العلمي.</p>
            </div>

            {/* بطاقات التواصل الأربع في شبكة واحدة */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* بطاقة واتساب: رابط مباشر يفتح محادثة واتساب في تبويب جديد.
                  rel="noopener noreferrer": أمان لضمان ألا يتلاعب الموقع الجديد بالصفحة. */}
              <div className="card text-center">
                <a href={CONTACT.whatsappLink} target="_blank" rel="noopener noreferrer" className="block h-full">
                  <MessageCircle className="mx-auto h-7 w-7 text-green-500" />
                  <h3 className="mt-2 text-sm font-bold text-ocean-900">واتساب</h3>
                  <p className="mt-1 text-xs font-bold text-green-600" dir="ltr">{CONTACT.whatsappDisplay}</p>
                </a>
              </div>
              <div className="card text-center">
                <Mail className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">البريد الإلكتروني</h3>
                <p className="mt-1 text-xs text-slate-500" dir="ltr">support@top-academy.example</p>
              </div>
              <div className="card text-center">
                <MessageSquare className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">الرد السريع</h3>
                <p className="mt-1 text-xs text-slate-500">نرد خلال 24-48 ساعة عمل</p>
              </div>
              <div className="card text-center">
                <Clock className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">ساعات الدعم</h3>
                <p className="mt-1 text-xs text-slate-500">السبت - الخميس · 9ص - 6م</p>
              </div>
            </div>

            {/* تنبيه طبي: لا تُجاب استشارات طبية عبر البريد العام. */}
            <div className="mt-6 rounded-2xl border border-ocean-100 bg-ocean-50/60 p-5 text-sm leading-relaxed text-ocean-800">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" />
                <span>
                  ننصح بالتواصل مع اختصاصي تغذية معتمد أو طبيب مختص مباشرةً لأي استشارة شخصية أو حالة صحية خاصة.
                  أسئلة الاستشارة الطبية لا يُجاب عنها عبر البريد العام.
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>
      {/* التذييل. */}
      <Footer />
    </>
  );
}
