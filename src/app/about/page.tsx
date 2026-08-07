import Link from 'next/link';
import { Sparkles, Target, HeartPulse, Users, Globe2, Award } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getCurrentUser } from '@/lib/auth';
import { BRAND } from '@/lib/constants';

export const metadata = { title: 'من نحن' };

const VALUES = [
  { icon: Sparkles, title: 'علم، لا تخمين', desc: 'كل حساب مبني على معادلات علمية معتمدة في مجال التغذية الرياضية.' },
  { icon: Target, title: 'خصوصية لكل سباح', desc: 'خطة مبنية على بياناتك أنت: التدريب، الهدف، الحالة الصحية، والتفضيلات.' },
  { icon: HeartPulse, title: 'السلامة أولًا', desc: 'حدود سعرات آمنة، تنبيهات طبية للقاصرين وذوي الحالات الصحية، وإخلاء مسؤولية واضح.' },
  { icon: Globe2, title: 'عربي بالكامل', desc: 'واجهة وخطط وأطعمة باللغة العربية مع تناسق مع الثقافة الغذائية العربية.' },
  { icon: Users, title: 'منصة متكاملة', desc: 'تصل السباح بمدربه واختصاصيه وتقارير الأداء في مكان واحد.' },
  { icon: Award, title: 'من إعداد متخصص', desc: `محتوى المنصة بإشراف ${BRAND.doctor}.` },
];

export default async function AboutPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar isLoggedIn={!!user} />
      <main className="water-bg">
        <section className="container-app py-16">
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

          <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="card card-hover">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-lagoon-500 text-white">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-ocean-900">{v.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <Link href={user ? '/swimmer-profile' : '/register'} className="btn-primary !px-8 !py-3.5 !text-base">
              ابدأ رحلتك معنا
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
