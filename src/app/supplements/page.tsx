import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { SupplementsGuide } from '@/components/supplements/supplements-guide';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Calculator, ShieldCheck, ArrowLeft, TriangleAlert } from 'lucide-react';
import { SUPPLEMENT_DISCLAIMER } from '@/lib/constants';

export const metadata = { title: 'دليل المكملات' };

export default async function SupplementsPage() {
  const user = await getCurrentUser();
  let isMinor = false;
  if (user) {
    const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
    isMinor = profile?.isMinor ?? false;
  }

  return (
    <>
      <Navbar isLoggedIn={!!user} />
      <main className="water-bg min-h-[70vh]">
        <div className="container-app py-12">
          <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-ocean-700 via-ocean-800 to-ocean-950 p-6 text-white shadow-xl sm:p-10">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-gold-300 ring-1 ring-white/20">
                    Smart Swimmer Supplement Calculator
                  </span>
                </div>
                <h1 className="text-2xl font-black leading-snug sm:text-3xl">
                  حاسبة المكملات الذكية للسباحين
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-ocean-100">
                  حلّل ملف السباح ومكونات المنتج وشركته المنتجة، واكتشف التداخلات والمخاطر، واحسب
                  الكميات التقديرية، مع فحص أولي لمكافحة المنشطات — غذاء طبيعي أولًا، ونتائج إرشادية
                  تُراجَع مع المختص.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href="/supplements/calculator"
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-bold text-ocean-950 shadow-lg shadow-gold-400/20 transition-all hover:bg-gold-300 active:scale-[0.98]"
                  >
                    <Calculator className="h-5 w-5" />
                    فتح حاسبة المكملات
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ocean-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    مرتبطة بملف السباح وتحليله ولوائح مكافحة المنشطات
                  </span>
                </div>
              </div>
              <div className="hidden shrink-0 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 lg:block">
                <p className="text-sm font-bold text-gold-300">إعداد وإشراف</p>
                <p className="mt-1 text-lg font-black">د. وليد عبد الرحمن عبد الظاهر</p>
                <p className="mt-1 text-xs text-ocean-200">TOP ACADEMY — Smart Swimmer Nutrition</p>
              </div>
            </div>
          </div>

          <SupplementsGuide isMinor={isMinor} />

          <div className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <p className="flex items-center gap-2 text-sm font-black text-amber-900">
              <TriangleAlert className="h-4 w-4" />
              تنبيه وإخلاء مسؤولية
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{SUPPLEMENT_DISCLAIMER}</p>
            <div className="mt-4 border-t border-amber-200 pt-3 text-center">
              <p className="text-sm font-bold text-ocean-900">إعداد وإشراف: د. وليد عبد الرحمن عبد الظاهر</p>
              <p className="mt-1 text-xs text-slate-500">TOP ACADEMY — Smart Swimmer Nutrition</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
