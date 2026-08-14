/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/about/page.tsx

وظيفة الملف:
صفحة "من نحن" (المسار /about). تعرض تعريفًا بالمنصة،
وقيمها الست، ومن يُشرف على محتواها العلمي، مع زر
"ابدأ رحلتك معنا".

لماذا نحتاجه؟
صفحة تعريفية تشرح للزائر ما هي المنصة ولماذا تثق بها،
وتوجهه لتسجيل الدخول أو إنشاء ملف السباح.

نوعها: Server Component (بدون 'use client').
تعمل في الخادم ويمكنها قراءة قاعدة البيانات قبل إرسال
الصفحة (هنا نعرف هل المستخدم مسجل لاختيار وجهة الزر).

متى يعمل؟
عند فتح الرابط /about (من القائمة أو رابط خارجي).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا لأي زيارة لمسار /about.

الملفات التي يتعامل معها:
- Navbar من components/layout/navbar (الشريط العلوي).
- Footer من components/layout/footer (التذييل).
- getCurrentUser من lib/auth (من هو المستخدم؟).
- BRAND من lib/constants (اسم المنصة وطبيب الإشراف).

ترتيب العمل:
1. جلب المستخدم الحالي (إن وجد).
2. عرض القائمة العلوية.
3. عرض تعريف المنصة والقيم الست.
4. زر "ابدأ رحلتك" → ملف السباح لو مسجل، أو التسجيل.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import Link from 'next/link'; // رابط داخلي (لا يعيد تحميل الصفحة) — من مكتبة next/link الخارجية.
import { Sparkles, Target, HeartPulse, Users, Globe2, Award } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية — واحدة لكل قيمة.
import { Navbar } from '@/components/layout/navbar'; // شريط التنقل العلوي — ملف محلي.
import { Footer } from '@/components/layout/footer'; // تذييل الصفحة — ملف محلي.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية تعيد المستخدم المسجل حاليًا أو null.
import { BRAND } from '@/lib/constants'; // ثوابت المنصة (الاسم، اسم الطبيب المشرف) — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'من نحن' };

// ========================================
// 3. الثوابت (قيم المنصة)
// ========================================

// VALUES: مصفوفة (Array) فيها 6 قيم.
// كل عنصر كائن (Object) يحمل: أيقونته، عنوانه، ووصفه.
// نستخدمها لرسم البطاقات بسرعة بدل كتابة 6 بطاقات يدويًا.
const VALUES = [
  { icon: Sparkles, title: 'علم، لا تخمين', desc: 'كل حساب مبني على معادلات علمية معتمدة في مجال التغذية الرياضية.' },
  { icon: Target, title: 'خصوصية لكل سباح', desc: 'خطة مبنية على بياناتك أنت: التدريب، الهدف، الحالة الصحية، والتفضيلات.' },
  { icon: HeartPulse, title: 'السلامة أولًا', desc: 'حدود سعرات آمنة، تنبيهات طبية للقاصرين وذوي الحالات الصحية، وإخلاء مسؤولية واضح.' },
  { icon: Globe2, title: 'عربي بالكامل', desc: 'واجهة وخطط وأطعمة باللغة العربية مع تناسق مع الثقافة الغذائية العربية.' },
  { icon: Users, title: 'منصة متكاملة', desc: 'تصل السباح بمدربه واختصاصيه وتقارير الأداء في مكان واحد.' },
  { icon: Award, title: 'من إعداد متخصص', desc: `محتوى المنصة بإشراف ${BRAND.doctor}.` },
];

// ========================================
// 4. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
دالة: AboutPage (الصفحة نفسها).
متى تعمل؟ عند فتح /about.
خطواتها:
1. معرفة من هو المستخدم (لاختيار وجهة زر البداية).
2. عرض القائمة العلوية مع حالة تسجيل الدخول.
3. عرض النص التعريفي ثم بطاقات القيم.
4. زر "ابدأ رحلتك" يذهب للتسجيل لو زائر، أو لملف السباح لو مسجل.
*/
export default async function AboutPage() {
  // user: المستخدم الحالي، أو null لو زائر غير مسجل.
  // await تعني: انتظر حتى يجيب الخادم من الجلسة.
  const user = await getCurrentUser();

  return (
    <>
      {/* الشريط العلوي: يظهر للمسجل "لوحة التحكم" وللزائر "تسجيل الدخول". */}
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg">
        <section className="container-app py-16">
          {/* النص التعريفي: اسم المنصة ووصفها + اسم المشرف العلمي. */}
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-black text-ocean-900">من نحن</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              <b className="text-ocean-800">{BRAND.nameAr} — {BRAND.nameEn}</b> منصة متخصصة في تغذية الرياضيين
              السباحين، تقدم حسابات علمية دقيقة، خططًا غذائية مرنة قابلة للتخصيص، تحليل وجبات بالكاميرا، ومتابعة
              يومية شاملة للالتزام والاستشفاء.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              يُشرف على المحتوى العلمي {BRAND.doctor} {BRAND.doctorTitle}، لضمان أن تكون كل توصية آمنة ومبنية
              على أحدث الأدلة في تغذية الرياضيين.
            </p>
          </div>

          {/* بطاقات القيم: map تمر على كل عنصر في VALUES وترسم بطاقة له.
              المفتاح key=title يساعد React على تمييز البطاقات عن بعضها. */}
          <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="card card-hover">
                {/* أيقونة القيمة داخل مربع متدرج اللون. */}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-lagoon-500 text-white">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-ocean-900">{v.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* زر البداية: مسجل → ملف السباح، زائر → صفحة التسجيل.
              الشرط الثلاثي user ? ... : ... يختار الوجهة. */}
          <div className="mx-auto mt-12 max-w-3xl text-center">
            <Link href={user ? '/swimmer-profile' : '/register'} className="btn-primary !px-8 !py-3.5 !text-base">
              ابدأ رحلتك معنا
            </Link>
          </div>
        </section>
      </main>
      {/* تذييل الصفحة. */}
      <Footer />
    </>
  );
}
