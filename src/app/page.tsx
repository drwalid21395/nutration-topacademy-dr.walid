import Link from 'next/link';
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
import { getCurrentUser } from '@/lib/auth';
import { BRAND, MEDICAL_DISCLAIMER } from '@/lib/constants';

const STATS = [
  { icon: Flame, label: 'سعرة اليوم', value: '—', hint: 'أنشئ خطة لحسابها' },
  { icon: Droplets, label: 'احتياج الماء', value: '~3.5 لتر', hint: 'تقديري يومي' },
  { icon: Utensils, label: 'الوجبات', value: '5-6', hint: 'وجبات يومية' },
  { icon: Dumbbell, label: 'التمرين', value: '6+', hint: 'جلسات أسبوعيًا' },
];

const STEPS = [
  { icon: UserPlus, title: 'أنشئ حسابك', desc: 'سجّل كسباح أو ولي أمر أو مدرب خلال دقيقة واحدة' },
  { icon: ClipboardList, title: 'أدخل بيانات السباح', desc: 'الطول، الوزن، التدريب، الهدف، والتفضيلات الغذائية' },
  { icon: Sparkles, title: 'احسب احتياجاته', desc: 'محرك علمي يحسب السعرات والمغذيات والماء بدقة' },
  { icon: Salad, title: 'احصل على خطة مخصصة', desc: 'خطة غذائية يومية بأيام متنوعة وبدائل لكل وجبة' },
  { icon: Camera, title: 'صوّر وجبتك', desc: 'حلّل الوجبات بالكاميرا وأضفها للسجل تلقائيًا' },
  { icon: TrendingUp, title: 'تابع التقدم', desc: 'رسوم بيانية أسبوعية للالتزام والوزن والاستشفاء' },
];

const SERVICES = [
  { icon: Camera, title: 'محلل الوجبات الذكي', desc: 'تصوير الوجبة بالكاميرا مع تقدير السعرات والمغذيات تلقائيًا' },
  { icon: CalendarDays, title: 'وضع الاستعداد للبطولة', desc: 'خطط الأسبوع السابق ويوم البطولة والاستشفاء بعدها' },
  { icon: FileText, title: 'تقارير PDF عربية', desc: 'تصدير الخطة بتصميم احترافي يحمل اسم الأكاديمية' },
  { icon: Bell, title: 'تنبيهات ذكية', desc: 'إشعارات الماء والوجبات والتدريب قابلة للتخصيص بالكامل' },
  { icon: HeartPulse, title: 'متابعة الاستشفاء', desc: 'تسجيل النوم والطاقة والإجهاد وتقييم التعافي' },
  { icon: Trophy, title: 'دليل المكملات التثقيفي', desc: 'معلومات عامة آمنة مع تنبيهات المراجعة الطبية' },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <>
      <Navbar isLoggedIn={isLoggedIn} user={user} />

      {/* البطل */}
      <section className="relative overflow-hidden bg-hero-waves text-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-40">
          <svg className="h-24 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,64 C240,120 480,0 720,40 C960,80 1200,0 1440,48 L1440,120 L0,120 Z" fill="#0a2438" />
          </svg>
        </div>
        <div className="container-app relative z-10 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-ocean-300/30 bg-ocean-300/10 px-4 py-1.5 text-xs font-bold text-ocean-200">
              <Sparkles className="h-4 w-4 text-gold-400" />
              {BRAND.nameAr} · {BRAND.productName}
            </span>
            <h1 className="mt-6 text-3xl font-black leading-tight sm:text-5xl lg:text-6xl">
              تغذية ذكية لسباحٍ
              <span className="block bg-gradient-to-l from-ocean-300 via-white to-gold-300 bg-clip-text text-transparent">
                أسرع وأقوى وأكثر استشفاءً
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              يقدّم النظام خطط تغذية مخصصة للسباحين مبنية على العلم؛ لتحسين الأداء داخل الماء،
              وتسريع الاستشفاء بعد التدريبات، والاستعداد الأمثل للبطولات — بإشراف
              <span className="font-bold text-gold-400"> {BRAND.doctor}</span>.
            </p>
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
            <div className="mt-4 text-xs text-slate-400">
              <span className="font-bold text-ocean-300">{BRAND.doctorTitle}:</span> {BRAND.doctor}
            </div>
          </div>

          {/* الإحصائيات */}
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

      {/* كيف يعمل */}
      <section className="water-bg py-16">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="section-title">كيف تعمل المنصة؟</h2>
            <p className="mt-3 text-slate-600">ست خطوات بسيطة من التسجيل حتى الخطة الجاهزة</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card card-hover relative">
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

      {/* الخدمات */}
      <section className="bg-white py-16">
        <div className="container-app">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="section-title">خدمات Top Academy</h2>
            <p className="mt-3 text-slate-600">منظومة متكاملة تغطي تغذية السباح من التدريب حتى البطولة</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="card card-hover">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-lagoon-500 text-white">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-ocean-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-gradient-to-l from-ocean-800 to-ocean-950 p-6 text-white sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="flex items-start gap-4">
                <ShieldCheck className="mt-1 h-10 w-10 shrink-0 text-gold-400" />
                <div>
                  <h3 className="text-xl font-bold">الخطط إرشادية — السلامة أولًا</h3>
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

      {/* CTA */}
      <section className="bg-ocean-50 py-16">
        <div className="container-app">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black text-ocean-900">جاهز تنطلق بخطة احترافية؟</h2>
            <p className="mt-3 text-slate-600">
              ابدأ الآن وأنشئ خطة السباح الأولى — مجانًا وبدون أي بيانات بنكية.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={isLoggedIn ? '/swimmer-profile' : '/register'} className="btn-primary !px-8 !py-3.5 !text-base">
                ابدأ الآن
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
