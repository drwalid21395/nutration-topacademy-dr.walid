/**
 * وحدة الحسابات الأساسية لحاسبة المكملات:
 * نسبة تغطية الاحتياج، العجز، الفائض، الحدود العليا الآمنة، وتصنيف النتائج.
 * كل القيم تقديرية غذائية، ولا تُستخدم للتشخيص أو وصف علاجي.
 */
import type { NutrientRow, CoverageClass, UpperLimitResult } from './types';

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

/** العجز التقديري = الاحتياج التقديري - المدخول (لا يُسمح بقيم سالبة) */
export function calculateNutrientDeficit(requirement: number, intake: number): number {
  return Math.max(requirement - intake, 0);
}

/** إجمالي المدخول = المدخول الغذائي + المدخول من المكمل */
export function calculateTotalSupplementIntake(
  fromFood: number,
  fromSupplement: number
): number {
  return Math.max(fromFood, 0) + Math.max(fromSupplement, 0);
}

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
