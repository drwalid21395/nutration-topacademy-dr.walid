/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/supplements/coverage.ts

وظيفة الملف:
"وحدة الحسابات الأساسية لحاسبة المكملات" — تحسب النسب والأرقام
التي تظهر في تقرير التغطية: نسبة تغطية الاحتياج، العجز، الفائض،
والحدود العليا الآمنة، وتصنيف النتائج.

لماذا نحتاجه؟
حتى نعرف بصدق: هل يغطي هذا السباح احتياج البروتين من الطعام مثلًا؟
وأين الفجوة؟ وهل يقترب من الحد الأعلى الآمن لأي عنصر؟

متى يعمل؟
يستدعيه ملف assessment.ts (buildCoverageRows) عبر buildNutrientRow،
وقد تُستخدم دواله مباشرة من صفحات عرض التغطية.

من يستدعي هذا الملف؟
- supplements/assessment.ts → buildNutrientRow.
- أي صفحة/واجهة تعرض صفوف التغطية أو تصنيفاتها.

الملفات التي يتعامل معها:
- ./types → NutrientRow, CoverageClass, UpperLimitResult (الأنواع).
- ./assessment → المستدعي الرئيسي.

ترتيب العمل:
القيم الخام (الاحتياج، المدخول الغذائي، مدخول المكمل) ↓
حساب النسب المئوية للغطاء والعجز والفائض ↓
فحص الحد الأعلى الآمن وموقعنا منه ↓
تصنيف نسبة التغطية + نص عربي للتصنيف ↓
تجميع كل شيء في NutrientRow كامل

ملاحظة مهمة:
كل الأرقام تقديرية غذائية (نماذج علمية مبسطة) وليست تشخيصًا
أو وصفًا علاجيًا.
==================================================
*/

/**
 * وحدة الحسابات الأساسية لحاسبة المكملات:
 * نسبة تغطية الاحتياج، العجز، الفائض، الحدود العليا الآمنة، وتصنيف النتائج.
 * كل القيم تقديرية غذائية، ولا تُستخدم للتشخيص أو وصف علاجي.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// الأنواع المشتركة بين وحدات المكملات (استيراد أنواع فقط).
import type { NutrientRow, CoverageClass, UpperLimitResult } from './types';

// ========================================
// 2. الدوال المُصدَّرة
// ========================================

/*
-----------------------------------------
الدالة: calculateNutrientCoverage
-----------------------------------------
وظيفتها: الحساب الأساسي — نسبة تغطية الاحتياج من الطعام ومن الإجمالي.
Input: الاحتياج التقديري + المدخول الغذائي + مدخول مكمل (اختياري).
Processing: تحويل المدخلات السالبة لصفر، حساب النسب المئوية
  بالتقريب، ثم العجز = الاحتياج - الإجمالي، والفائض عكسه.
Output: النسب المئوية + الإجمالي + العجز + الفائض.
-----------------------------------------
*/
/** نسبة التغطية من الطعام = المدخول الغذائي ÷ الاحتياج التقديري × 100 */
export function calculateNutrientCoverage(
  requirement: number,
  fromFood: number,
  fromSupplement = 0
): Pick<NutrientRow, 'coverageFoodPct' | 'coverageTotalPct' | 'total' | 'deficit' | 'surplus'> {
  const safeReq = Math.max(requirement, 0);
  const total = Math.max(fromFood + fromSupplement, 0);
  const coverageFoodPct = safeReq > 0 ? Math.round((fromFood / safeReq) * 100) : 0;
  const coverageTotalPct = safeReq > 0 ? Math.round((total / safeReq) * 100) : 0;
  const deficit = Math.max(safeReq - total, 0);
  const surplus = Math.max(total - safeReq, 0);
  return { coverageFoodPct, coverageTotalPct, total, deficit, surplus };
}

/*
-----------------------------------------
الدالة: calculateNutrientDeficit
-----------------------------------------
وظيفتها: حساب العجز التقديري بعملية بسيطة.
Input: الاحتياج + المدخول.
Processing: الاحتياج - المدخول، مع منع النتيجة السالبة (لا نقول
  "عجز سالب") — فلا يُحسب عجز ما دام المدخول كافيًا.
Output: رقم العجز (0 فأكثر).
-----------------------------------------
*/
/** العجز التقديري = الاحتياج التقديري - المدخول (لا يُسمح بقيم سالبة) */
export function calculateNutrientDeficit(requirement: number, intake: number): number {
  return Math.max(requirement - intake, 0);
}

/*
-----------------------------------------
الدالة: calculateTotalSupplementIntake
-----------------------------------------
وظيفتها: جمع إجمالي المدخول (غذائي + مكمل).
Input: المدخول الغذائي + مدخول المكمل.
Processing: جمع الرقمين بعد تجاهل أي قيم سالبة.
Output: الإجمالي (0 فأكثر).
-----------------------------------------
*/
/** إجمالي المدخول = المدخول الغذائي + المدخول من المكمل */
export function calculateTotalSupplementIntake(
  fromFood: number,
  fromSupplement: number
): number {
  return Math.max(fromFood, 0) + Math.max(fromSupplement, 0);
}

/*
-----------------------------------------
الدالة: checkUpperLimit
-----------------------------------------
وظيفتها: فحص الحد الأعلى الآمن عند توفر مرجع علمي.
Input: المدخول + الحد الأعلى (قد يكون غير متوفر).
Processing: إن لم يوجد حد أعلى صالح → ok. إن بلغ المدخول الحد →
  تجاوز. إن بقي أقل من 10% من الحد → اقتراب (تحذير). غير ذلك → ok.
Output: الحالة + المتبقي حتى الحد (أو null).
-----------------------------------------
*/
/**
 * فحص الحد الأعلى الآمن عند توفر مرجع علمي:
 * - 90% من الحد الأعلى ← "اقتراب" (تحذير)
 * - تجاوز الحد الأعلى ← "تجاوز" (منع التوصية)
 */
export function checkUpperLimit(
  intake: number,
  upperLimit: number | null | undefined
): UpperLimitResult {
  if (!upperLimit || upperLimit <= 0) return { status: 'ok', remainingToLimit: null };
  const remainingToLimit = upperLimit - intake;
  if (intake >= upperLimit) return { status: 'exceeded', remainingToLimit };
  if (remainingToLimit <= upperLimit * 0.1) return { status: 'approaching', remainingToLimit };
  return { status: 'ok', remainingToLimit };
}

/*
-----------------------------------------
الدالة: classifyCoverage
-----------------------------------------
وظيفتها: تحويل نسبة التغطية إلى تصنيف نصي منطقي.
Input: النسبة المئوية.
Processing:
  - أقل من 70% → منخفضة.
  - 70–90% → تحتاج تحسينًا غذائيًا.
  - 90–110% → نطاق مناسب تقديريًا.
  - أكثر من 110% → مراجعة الزيادة.
Output: CoverageClass.
-----------------------------------------
*/
/**
 * تصنيف نسبة التغطية:
 * < 70% منخفضة، 70–90% تحتاج تحسينًا غذائيًا، 90–110% مناسب، > 110% مراجعة الزيادة.
 */
export function classifyCoverage(pct: number): CoverageClass {
  if (pct < 70) return 'low';
  if (pct < 90) return 'improve';
  if (pct <= 110) return 'ok';
  return 'review';
}

/*
-----------------------------------------
الدالة: coverageClassLabel
-----------------------------------------
وظيفتها: إرجاع نص عربي واضح يصف التصنيف للعرض للمستخدم.
Input: CoverageClass.
Processing: تحويل كل تصنيف إلى جملة عربية مناسبة.
Output: نص عربي (مثل "تغطية منخفضة").
-----------------------------------------
*/
export function coverageClassLabel(c: CoverageClass): string {
  switch (c) {
    case 'low':
      return 'تغطية منخفضة';
    case 'improve':
      return 'تحتاج تحسينًا غذائيًا';
    case 'ok':
      return 'نطاق مناسب تقديريًا';
    case 'review':
      return 'مراجعة الزيادة';
  }
}

/*
-----------------------------------------
الدالة: buildNutrientRow
-----------------------------------------
وظيفتها: بناء صف تغطية كامل بالجمع بين كل الحسابات السابقة.
Input: المفتاح + الاسم العربي + الوحدة + الاحتياج + المدخول الغذائي
  + مدخول مكمل اختياري + حد أعلى اختياري.
Processing: يستدعي calculateNutrientCoverage ثم checkUpperLimit
  ويجمّع كل الحقول مع منع أي قيم سالبة.
Output: NutrientRow (صف كامل وجاهز للعرض).
يُستدعى من: assessment.ts (buildCoverageRows) لتغطية المغذيات الأساسية.
-----------------------------------------
*/
/** بناء صف تغطية كامل (بما فيه الحدود والتصنيف) */
export function buildNutrientRow(input: {
  key: string;
  nameAr: string;
  unit: string;
  requirement: number;
  fromFood: number;
  fromSupplement?: number;
  upperLimit?: number | null;
}): NutrientRow {
  const base = calculateNutrientCoverage(input.requirement, input.fromFood, input.fromSupplement ?? 0);
  const limit = checkUpperLimit(base.total, input.upperLimit);
  return {
    key: input.key,
    nameAr: input.nameAr,
    unit: input.unit,
    requirement: Math.max(input.requirement, 0),
    fromFood: Math.max(input.fromFood, 0),
    fromSupplement: Math.max(input.fromSupplement ?? 0, 0),
    total: base.total,
    deficit: base.deficit,
    surplus: base.surplus,
    coverageFoodPct: base.coverageFoodPct,
    coverageTotalPct: base.coverageTotalPct,
    upperLimit: input.upperLimit ?? null,
    limitStatus: limit.status,
  };
}
