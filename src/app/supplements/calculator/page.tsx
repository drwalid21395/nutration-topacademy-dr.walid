/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/supplements/calculator/page.tsx

وظيفة الملف:
صفحة "حاسبة المكملات الذكية" (المسار /supplements/calculator)
— صفحة رقيقة تعرض مكوّن SupplementsCalculator داخل إطار
الصفحات العامة (Navbar + Footer). لا يلزم تسجيل الدخول.

لماذا نحتاجه؟
حاسبة المكملات تثقيفية ومتاحة للزوار؛ الصفحة هنا مجرد
حاوية لعرض المكوّن الذي يدير كل شيء بنفسه.

نوعها: Server Component (بدون 'use client').
الخادم يحدد فقط حالة تسجيل الدخول لشكل القائمة العلوية.

متى يعمل؟
عند فتح /supplements/calculator (من زر "فتح حاسبة
المكملات" في صفحة دليل المكملات).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- Navbar من components/layout/navbar و Footer من components/layout/footer.
- SupplementsCalculator من components/supplements/supplements-calculator.
- getCurrentUser من lib/auth.

ترتيب العمل:
1. معرفة المستخدم الحالي (إن وجد).
2. عرض الشريط العلوي.
3. عرض مكوّن الحاسبة.
4. التذييل.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { Navbar } from '@/components/layout/navbar'; // الشريط العلوي — ملف محلي.
import { Footer } from '@/components/layout/footer'; // التذييل — ملف محلي.
import { SupplementsCalculator } from '@/components/supplements/supplements-calculator'; // مكوّن حاسبة المكملات — ملف محلي.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'حاسبة المكملات الذكية' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// SupplementsCalculatorPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function SupplementsCalculatorPage() {
  // المستخدم الحالي (قد يكون null لو زائر) — لشكل القائمة العلوية.
  const user = await getCurrentUser();
  return (
    <>
      {/* الشريط العلوي. */}
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg min-h-[70vh]">
        <div className="container-app py-12">
          {/* مكوّن الحاسبة الفعلي (يدير حساباته بنفسه في المتصفح). */}
          <SupplementsCalculator />
        </div>
      </main>
      {/* التذييل. */}
      <Footer />
    </>
  );
}
