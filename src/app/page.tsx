/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/page.tsx

وظيفة الملف:
الصفحة الرئيسية (المسار /) — أول ما يراه الزائر.
تعرض: مقدمة الموقع، إحصائيات، خطوات العمل، الخدمات، ودعوة للانطلاق.

لماذا نحتاجه؟
هذه "واجهة المتجر". هدفها إقناع الزائر بإنشاء حساب،
وتوجيهه لزر مناسب حسب حالته (مسجل أو لا).

متى يعمل؟
عند فتح عنوان الموقع الرئيسي.

من يستدعيها؟
Next.js يقرأ الملف src/app/page.tsx تلقائيًا كصفحة الرئسية.
(لا يوجد من "يستدعيها" بكود — المسار هو الدعوة.)

نوعها: Server Component (بدون 'use client').
يعني أنها تعمل في الخادم وتقرأ بيانات الجلسة قبل إرسال HTML.

ترتيب التنفيذ:
1. getCurrentUser() يفحص هل الزائر مسجل؟
2. يحدد الروابط المناسبة (إنشاء نظام / تحليل وجبة).
3. يعرض المكونات: Navbar + أقسام الصفحة + Footer.

العلاقة مع الملفات:
- Navbar و Footer من components/layout.
- getCurrentUser من lib/auth (جلسة الدخول).
- BRAND وMEDICAL_DISCLAIMER من lib/constants.

ملاحظة تعليمية:
- المصفوفات الثلاث (STATS, STEPS, SERVICES) بيانات ثابتة
  نعرضها بتكرار عبر map().
- أيقونات lucide-react تُستخدم كأسماء مكونات: <Flame />.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// Link: مكوّن Next.js للتنقل بين الصفحات (بدون إعادة تحميل كاملة).
import Link from 'next/link';
// أيقونات من مكتبة lucide-react (مكتبة خارجية للأيقونات).
// نستورد الأيقونات التي سنستخدمها كأسماء مكونات.
import {
  Flame,
  Droplets,
  Utensils,
  Dumbbell,
  Camera,
  ClipboardList,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  FileText,
  Bell,
  TrendingUp,
  ChevronLeft,
  ArrowLeft,
  Trophy,
  HeartPulse,
  Salad,
  UserPlus,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
// getCurrentUser: من ملفنا lib/auth — تجلب المستخدم المسجل حاليًا.
import { getCurrentUser } from '@/lib/auth';
// BRAND: أسماء العلامة التجارية. MEDICAL_DISCLAIMER: النص الطبي القانوني.
import { BRAND, MEDICAL_DISCLAIMER } from '@/lib/constants';

// ========================================
// 2. البيانات الثابتة المعروضة في الصفحة
// ========================================

// STATS: بطاقات الإحصائيات في أعلى الصفحة.
// كل عنصر: أيقونة + عنوان + قيمة + توضيح.
// icon: نضع اسم المكوّن نفسه (وليس وسمًا) ثم نستخدمه بـ <s.icon />.
const STATS = [
  { icon: Flame, label: 'سعرة اليوم', value: '—', hint: 'أنشئ خطة لحسابها' },
  { icon: Droplets, label: 'احتياج الماء', value: '~3.5 لتر', hint: 'تقديري يومي' },
  { icon: Utensils, label: 'الوجبات', value: '5-6', hint: 'وجبات يومية' },
  { icon: Dumbbell, label: 'التمرين', value: '6+', hint: 'جلسات أسبوعيًا' },
];

// STEPS: خطوات "كيف تعمل المنصة" الست.
// i (الترتيب) سنستخدمها لعرض رقم الخطوة 1..6.
const STEPS = [
  { icon: UserPlus, title: 'أنشئ حسابك', desc: 'سجّل كسباح أو ولي أمر أو مدرب خلال دقيقة واحدة' },
  { icon: ClipboardList, title: 'أدخل بيانات السباح', desc: 'الطول، الوزن، التدريب، الهدف، والتفضيلات الغذائية' },
  { icon: Sparkles, title: 'احسب احتياجاته', desc: 'محرك علمي يحسب السعرات والمغذيات والماء بدقة' },
  { icon: Salad, title: 'احصل على خطة مخصصة', desc: 'خطة غذائية يومية بأيام متنوعة وبدائل لكل وجبة' },
  { icon: Camera, title: 'صوّر وجبتك', desc: 'حلّل الوجبات بالكاميرا وأضفها للسجل تلقائيًا' },
  { icon: TrendingUp, title: 'تابع التقدم', desc: 'رسوم بيانية أسبوعية للالتزام والوزن والاستشفاء' },
];

// SERVICES: قائمة الخدمات الست المعروضة في المنتصف.
const SERVICES = [
  { icon: Camera, title: 'محلل الوجبات الذكي', desc: 'تصوير الوجبة بالكاميرا مع تقدير السعرات والمغذيات تلقائيًا' },
  { icon: CalendarDays, title: 'وضع الاستعداد للبطولة', desc: 'خطط الأسبوع السابق ويوم البطولة والاستشفاء بعدها' },
  { icon: FileText, title: 'تقارير PDF عربية', desc: 'تصدير الخطة بتصميم احترافي يحمل اسم الأكاديمية' },
  { icon: Bell, title: 'تنبيهات ذكية', desc: 'إشعارات الماء والوجبات والتدريب قابلة للتخصيص بالكامل' },
  { icon: HeartPulse, title: 'متابعة الاستشفاء', desc: 'تسجيل النوم والطاقة والإجهاد وتقييم التعافي' },
  { icon: Trophy, title: 'دليل المكملات التثقيفي', desc: 'معلومات عامة آمنة مع تنبيهات المراجعة الطبية' },
];

// ========================================
// 3. المكوّن الرئيسي للصفحة
// ========================================

/*
-----------------------------------------
الدالة: HomePage
-----------------------------------------
وظيفتها: عرض الصفحة الرئيسية كاملة.
متى تعمل؟ عند فتح الموقع (المسار /).
ماذا تفعل:
1. تجلب المستخدم الحالي من الجلسة.
2. تحسب isLoggedIn.
3. تعرض شريط التنقل والأقسام والتذييل.
ترتيب التنفيذ: من الأعلى للأسفل داخل JSX.
-----------------------------------------
*/
export default async function HomePage() {
  // الخطوة 1: من هو المستخدم الحالي؟ (أو null لو زائر).
  // await: ننتظر حتى يرد الخادم بالجلسة قبل المتابعة.
  const user = await getCurrentUser();

  // الخطوة 2: تحويل المستخدم إلى قيمة منطقية (مسجل أو لا).
  // !! = تحويل لأول مرتين: القيمة تصبح true/false صرف.
  const isLoggedIn = !!user;

  return (
    <>
      {/* شريط التنقل — ينقل الزائر للدخول أو لوحة التحكم حسب حالته. */}
      <Navbar isLoggedIn={isLoggedIn} user={user} />

      {/* ======= قسم البطل (Hero) ======= */}
      {/* الخلفية أزرق بأمواج (bg-hero-waves من tailwind.config). */}
      <section className="relative overflow-hidden bg-hero-waves text-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-40">
          {/* SVG: شكل موجة زرقاء أسفل القسم (عنصر رسومي مكتوب يدويًا). */}
          <svg className="h-24 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,64 C240,120 480,0 720,40 C960,80 1200,0 1440,48 L1440,120 L0,120 Z" fill="#0a2438" />
          </svg>
        </div>
        <div className="container-app relative z-10 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            {/* شارة صغيرة أعلى العنوان (اسم الأكاديمية + المنتج). */}
            <span className="inline-flex items-center gap-2 rounded-full border border-ocean-300/30 bg-ocean-300/10 px-4 py-1.5 text-xs font-bold text-ocean-200">
              <Sparkles className="h-4 w-4 text-gold-400" />
              {BRAND.nameAr} · {BRAND.productName}
            </span>
            {/* العنوان الرئيسي — نستخدم {} لعرض متغير/مكون داخل JSX. */}
            <h1 className="mt-6 text-3xl font-black leading-tight sm:text-5xl lg:text-6xl">
              تغذية ذكية لسباحٍ
              {/* bg-clip-text: جعل الخط ملوّنًا بتدرج ألوان (ذهبي-أبيض). */}
              <span className="block bg-gradient-to-l from-ocean-300 via-white to-gold-300 bg-clip-text text-transparent">
                أسرع وأقوى وأكثر استشفاءً
              </span>
            </h1>
            {/* فقرة التعريف بالمنصة — اسم الدكتور يظهر بخط ذهبي عريض. */}
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              يقدّم النظام خطط تغذية مخصصة للسباحين مبنية على العلم؛ لتحسين الأداء داخل الماء،
              وتسريع الاستشفاء بعد التدريبات، والاستعداد الأمثل للبطولات — بإشراف
              <span className="font-bold text-gold-400"> {BRAND.doctor}</span>.
            </p>
            {/* أزرار الإجراء — تتغير وجهتها حسب حالة الدخول:
                مسجل → صفحة إنشاء خطة / زائر → صفحة التسجيل. */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={isLoggedIn ? '/plan/create' : '/register'} className="btn-gold !px-7 !py-3.5 !text-base">
                <Salad className="h-5 w-5" />
                إنشاء نظام غذائي
              </Link>
              <Link href={isLoggedIn ? '/meal-analyzer' : '/login'} className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                <Camera className="h-5 w-5" />
                تحليل وجبة بالكاميرا
              </Link>
              <Link href={isLoggedIn ? '/food-log' : '/login'} className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                <ClipboardList className="h-5 w-5" />
                متابعة الخطة اليومية
              </Link>
            </div>
            {/* سطر تحت الأزرار يذكر اسم الدكتور ولقبه. */}
            <div className="mt-4 text-xs text-slate-400">
              <span className="font-bold text-ocean-300">{BRAND.doctorTitle}:</span> {BRAND.doctor}
            </div>
          </div>

          {/* بطاقات الإحصائيات — نكرر عبر STATS.map().
              map = loop: يمر على كل عنصر ويصنع منه بطاقة.
              key: معرف فريد يساعد React على ترتيب العناصر بكفاءة. */}
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
                <s.icon className="mx-auto h-6 w-6 text-ocean-300" />
                <p className="mt-2 text-2xl font-black">{s.value}</p>
                <p className="text-xs font-semibold text-slate-300">{s.label}</p>
                <p className="text-[10px] text-slate-400">{s.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= قسم "كيف تعمل المنصة" ======= */}
      <section className="water-bg py-16">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="section-title">كيف تعمل المنصة؟</h2>
            <p className="mt-3 text-slate-600">ست خطوات بسيطة من التسجيل حتى الخطة الجاهزة</p>
          </div>
          {/* الخطوات الست — map تعطي (s = العنصر, i = ترتيبه من 0).
              نعرض i + 1 ليظهر الرقم 1..6. */}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card card-hover relative">
                {/* رقم الخطوة في دائرة ملونة أعلى البطاقة. */}
                <span className="absolute -top-3 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-ocean-600 text-sm font-black text-white shadow-md">
                  {i + 1}
                </span>
                <s.icon className="h-8 w-8 text-ocean-500" />
                <h3 className="mt-3 text-lg font-bold text-ocean-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= قسم الخدمات ======= */}
      <section className="bg-white py-16">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="section-title">خدمات Top Academy</h2>
            <p className="mt-3 text-slate-600">منظومة متكاملة تغطي تغذية السباح من التدريب حتى البطولة</p>
          </div>
          {/* نكرر على SERVICES لعرض الخدمات الست. */}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="card card-hover">
                {/* مربع ملوّن بتدرج من المحيط إلى اللاجون يحمل الأيقونة. */}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-lagoon-500 text-white">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-ocean-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* شريط التنبيه الطبي (إخلاء المسؤولية) في نهاية القسم. */}
          <div className="mt-12 rounded-2xl bg-gradient-to-l from-ocean-800 to-ocean-950 p-6 text-white sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="flex items-start gap-4">
                <ShieldCheck className="mt-1 h-10 w-10 shrink-0 text-gold-400" />
                <div>
                  <h3 className="text-xl font-bold">الخطط إرشادية — السلامة أولًا</h3>
                  {/* MEDICAL_DISCLAIMER: النص القانوني من constants.ts. */}
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{MEDICAL_DISCLAIMER}</p>
                </div>
              </div>
              <Link href="/medical-disclaimer" className="btn-gold shrink-0">
                قراءة إخلاء المسؤولية
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======= قسم الدعوة الختامية (CTA) ======= */}
      <section className="bg-ocean-50 py-16">
        <div className="container-app">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black text-ocean-900">جاهز تنطلق بخطة احترافية؟</h2>
            <p className="mt-3 text-slate-600">
              ابدأ الآن وأنشئ خطة السباح الأولى — مجانًا وبدون أي بيانات بنكية.
            </p>
            {/* زر أخير — مسجل؟ اذهب لملف السباح. زائر؟ سجّل الآن. */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={isLoggedIn ? '/swimmer-profile' : '/register'} className="btn-primary !px-8 !py-3.5 !text-base">
                ابدأ الآن
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* تذييل الصفحة. */}
      <Footer />
    </>
  );
}
