/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/supplements/page.tsx

وظيفة الملف:
صفحة "دليل المكملات" (المسار /supplements) — صفحة عامة
تعرض ترويسة تعريفية جميلة، زر فتح الحاسبة، مكوّن
SupplementsGuide، وتنبيهًا بإخلاء المسؤولية. تحسب أيضًا
هل المستخدم قاصر (isMinor) لتمريره للدليل.

لماذا نحتاجه؟
مدخل المكملات التثقيفي: يشرح للزائر والأعضاء المكملات
ومخاطرها ويربطه بالحاسبة الذكية.

نوعها: Server Component (بدون 'use client').
تقوم بجلب واحد من قاعدة البيانات (هل المستخدم قاصر؟) قبل
عرض الصفحة.

متى يعمل؟
عند فتح /supplements (من القائمة أو رابط خارجي).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- Navbar و Footer من components/layout.
- SupplementsGuide من components/supplements/supplements-guide.
- getCurrentUser من lib/auth و prisma من lib/prisma.
- SUPPLEMENT_DISCLAIMER من lib/constants.

ترتيب العمل:
1. معرفة المستخدم (قد يكون زائرًا).
2. لو مستخدم: جلب ملفه لمعرفة هل قاصر.
3. عرض الترويسة + زر الحاسبة + الدليل (مع isMinor) + التنبيه.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { Navbar } from '@/components/layout/navbar'; // الشريط العلوي — ملف محلي.
import { Footer } from '@/components/layout/footer'; // التذييل — ملف محلي.
import { SupplementsGuide } from '@/components/supplements/supplements-guide'; // مكوّن دليل المكملات — ملف محلي.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { Calculator, ShieldCheck, ArrowLeft, TriangleAlert } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { SUPPLEMENT_DISCLAIMER } from '@/lib/constants'; // نص إخلاء مسؤولية المكملات — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'دليل المكملات' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// SupplementsPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function SupplementsPage() {
  // الخطوة 1: من هو المستخدم؟ (قد يكون null لو زائر).
  const user = await getCurrentUser();
  // هل المستخدم قاصر؟ الافتراضي false.
  let isMinor = false;
  // لو مستخدم مسجل: نجلب ملفه لمعرفة إن كان قاصرًا
  // (الدليل يعرض تحذيرات إضافية للقاصرين).
  if (user) {
    const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
    isMinor = profile?.isMinor ?? false;
  }

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <>
      {/* الشريط العلوي. */}
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg min-h-[70vh]">
        <div className="container-app py-12">
          {/* الترويسة: بطاقة داكنة كبيرة تعرض اسم الحاسبة ووصفها وزر فتحها */}
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
                  {/* زر فتح الحاسبة في صفحتها */}
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
              {/* بطاقة الإشراف العلمي (تظهر فقط على الشاشات الكبيرة). */}
              <div className="hidden shrink-0 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 lg:block">
                <p className="text-sm font-bold text-gold-300">إعداد وإشراف</p>
                <p className="mt-1 text-lg font-black">د. وليد عبد الرحمن عبد الظاهر</p>
                <p className="mt-1 text-xs text-ocean-200">TOP ACADEMY — Smart Swimmer Nutrition</p>
              </div>
            </div>
          </div>

          {/* الدليل الفعلي: نمرر له isMinor ليعرض تحذيرات القاصرين */}
          <SupplementsGuide isMinor={isMinor} />

          {/* تنبيه إخلاء المسؤولية: النص من الثوابت */}
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
      {/* التذييل. */}
      <Footer />
    </>
  );
}
