/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/supplements/types.ts

وظيفة الملف:
"الأنواع المشتركة لحاسبة المكملات" — كل الأشكال (interfaces)
التي تتبادلها وحدات المكملات فيما بينها: صف التغطية، سياق الأهلية،
نتيجة البروتين، الترطيب، الجدول، ومدخلات/مخرجات التقييم الكامل.

لماذا نحتاجه؟
تحديد شكل البيانات مرة واحدة يمنع الأخطاء ويجعل كل الوحدات تفهم
بعضها: الوحدة التي تحسب والوحدة التي تعرض تستخدمان نفس الشكل.

متى يعمل؟
وقت الترجمة فقط (TypeScript) — لا يحتوي منطقًا تشغيليًا.

من يستدعي هذا الملف؟
- كل ملفات supplements (coverage/eligibility/protein/hydration/schedule/assessment).
- الصفحات وواجهات API التي تعرض نتائج المكملات.

ملاحظة مهمة:
هذا الملف يضم الأنواع فقط، والشكل النصي الوحيد هنا هو
ELIGIBILITY_VERDICTS (أسماء الحالات النهائية بمعانيها العربية).

ترتيب العمل:
تعريف الأنواع الأساسية (صف التغطية، الأهلية) ↓
نتائج الحسابات الفرعية (بروتين، ترطيب، جدول) ↓
مدخلات ومخرجات التقييم الكامل
==================================================
*/

/** أنواع ومخرجات حاسبة المكملات الذكية — تغذية فقط، لا وصفات علاجية. */

// ========================================
// 1. تغطية الاحتياجات
// ========================================

// صف واحد يلخص تغطية عنصر غذائي: المطلوب، المتناول، العجز، النسب، والحد الأعلى.
export interface NutrientRow {
  key: string;
  nameAr: string;
  unit: string;
  requirement: number;
  fromFood: number;
  fromSupplement: number;
  total: number;
  deficit: number; // لا قيم سالبة
  surplus: number;
  coverageFoodPct: number;
  coverageTotalPct: number;
  upperLimit: number | null;
  limitStatus: 'none' | 'ok' | 'approaching' | 'exceeded';
}

// تصنيف نسبة التغطية: منخفضة / تحتاج تحسينًا / مناسبة / مراجعة الزيادة.
export type CoverageClass = 'low' | 'improve' | 'ok' | 'review';

// نتيجة فحص الحد الأعلى: الحالة + الكمية المتبقية حتى الحد.
export interface UpperLimitResult {
  status: 'ok' | 'approaching' | 'exceeded';
  remainingToLimit: number | null;
}

// ========================================
// 2. سياق الأهلية ونتيجته
// ========================================

// كل المعلومات التي يستخدمها محرك الأهلية لفحص مكمل واحد.
export interface EligibilityContext {
  isMinor: boolean;
  guardianConsent: boolean;
  age: number | null;
  gender: string | null;
  chronicConditions: string | null;
  medications: string | null;
  allergies: string | null;
  digestiveIssues: string | null;
  pregnancyStatus: string | null;
  hasEatingDisorderHistory: boolean;
  competitionMode: boolean;
  competitionDaysAway: number | null;
  currentIngredients: { name: string; amount: number; unit: string }[];
  dietaryDeficitForTarget: boolean;
  hasRelevantLab: boolean;
}

// نتيجة فحص الأهلية: مسموح؟ + الحالة + الأسباب + أعلام (مطلوب طبيب/تحليل...).
export interface EligibilityResult {
  ok: boolean;
  verdict: string; // one of ELIGIBILITY_VERDICTS
  reasons: string[];
  flags: { needsGuardian: boolean; needsLab: boolean; needsDoctor: boolean; competitionRestricted: boolean; dopingRestricted: boolean };
}

// أسماء الحالات النهائية بمعانيها العربية (تُستخدم في العروض).
export const ELIGIBILITY_VERDICTS: Record<string, string> = {
  suitable: 'مناسب للتقييم الغذائي',
  'food-sufficient': 'الغذاء الطبيعي كافٍ ولا توجد حاجة واضحة',
  'diet-first': 'يحتاج إلى تعديل النظام الغذائي أولًا',
  'needs-lab': 'يحتاج إلى تحليل طبي قبل التقييم',
  'needs-doctor': 'يحتاج إلى موافقة طبيب',
  'minor-consent': 'يتطلب موافقة ولي الأمر',
  'age-blocked': 'غير مناسب للعمر',
  'health-blocked': 'غير مناسب بسبب الحالة الصحية',
  'drug-interaction': 'يوجد تداخل محتمل مع دواء',
  'upper-limit-risk': 'يوجد خطر تجاوز الحد الأعلى',
  'no-auto-dose': 'غير مسموح للنظام بحساب جرعته تلقائيًا',
  'high-risk': 'مكمل عالي الخطورة أو غير مدعوم بأدلة كافية',
  'doping-blocked': 'ممنوع أو يحتاج تحققًا وفق لوائح مكافحة المنشطات',
  'competition-blocked': 'ممنوع قبل البطولة — لم يُجرَّب خلال التدريب',
};

// ========================================
// 3. نتائج الحسابات الفرعية
// ========================================

// نتيجة حساب فجوة البروتين: العجز + خيارات غذائية + جزء المسحوق.
export interface ProteinGapResult {
  requirementG: number;
  fromFoodG: number;
  deficitG: number;
  gapCoverableByFood: boolean;
  foodOptions: { nameAr: string; grams: number; proteinG: number; calories: number }[];
  supplementPartG: number; // عجز لا تغطيه الخيارات الغذائية
  powderScoops: number; // حصص تقديرية من مسحوق (25 جم/حصة)
  note: string;
}

// نتيجة حساب الترطيب: فقدان الوزن، التعرق، السوائل، والتحذيرات.
export interface HydrationResult {
  weightLossKg: number;
  weightLossPct: number;
  sweatRateLh: number;
  fluidsDuringMl: number;
  fluidsAfterMl: number;
  electrolytesRecommended: boolean;
  sodiumFromFoodMg: number;
  warnings: string[];
}

// سطر في الجدول اليومي: الوقت + المكمل + الجرعة + السبب.
export interface ScheduleRow {
  time: string;
  item: string;
  dose: string;
  withFood: boolean;
  reason: string;
  onRestDay: boolean;
  onCompetitionDay: boolean;
}

// ========================================
// 4. مدخلات ومخرجات التقييم الكامل
// ========================================

// كل بيانات السباح التي يدخلها النظام إلى التقييم الشامل.
export interface SupplementAssessmentInput {
  profileId: string | null;
  isMinor: boolean;
  guardianConsent: boolean;
  age: number | null;
  gender: string | null;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  goal: string | null;
  dietType: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  medications: string | null;
  digestiveIssues: string | null;
  pregnancyStatus: string | null;
  swimSessionsPerWeek: number | null;
  swimMinutesPerSession: number | null;
  trainingIntensity: string | null;
  hasDoubleTraining: boolean;
  sleepHours: number | null;
  nextCompetitionDate: string | null;
  competitionMode: boolean;
  dailyCaloriesTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  fiberTarget: number | null;
  waterTarget: number | null;
  trainingWaterMl: number | null;
  sodiumTarget: number | null;
  avgFoodCalories: number;
  avgFoodProteinG: number;
  avgFoodCarbsG: number;
  avgFoodFatG: number;
  avgFoodFiberG: number;
  avgFoodSodiumMg: number;
  avgWaterMl: number;
  products: { name: string; ingredients: { name: string; amount: number; unit: string }[] }[];
  medicationsList: string[];
  labResults: { marker: string; value: number; unit: string; referenceRange: string | null; markerAr: string | null }[];
}

// مخرجات التقييم الشامل: التغطية، الأهلية، التوصيات، الجدول، والملخص.
export interface SupplementAssessmentOutput {
  version: string;
  overallLevel: 'none' | 'low' | 'medium' | 'specialist';
  needsMedicalApproval: boolean;
  needsGuardianConsent: boolean;
  needsLabTest: boolean;
  coverage: NutrientRow[];
  eligibility: { key: string; nameAr: string; verdict: string; ok: boolean; reasons: string[] }[];
  proteinGap: ProteinGapResult | null;
  hydration: HydrationResult | null;
  recommendations: {
    key: string;
    nameAr: string;
    status: 'food-first' | 'needs-review' | 'blocked';
    verdict: string;
    evidenceStrength: string;
    coverageFromFoodPct: number;
    deficit: number;
    doseEstimate: number | null;
    doseUnit: string;
    timingAr: string;
    durationDays: number | null;
    upperLimitWarning: string | null;
    medicalNote: string;
  }[];
  schedule: ScheduleRow[];
  foodAlternatives: { key: string; nameAr: string; options: { nameAr: string; grams: number; proteinG: number; calories: number }[] }[];
  summary: string;
}
