/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/supplements/protein.ts

وظيفة الملف:
"حساب البروتين والمكملات البروتينية" — يقارن الاحتياج اليومي
بالبروتين المستهلك من الطعام، يحسب العجز، ويحاول تغطيته
غذائيًا أولًا قبل اللجوء إلى مسحوق البروتين.

لماذا نحتاجه؟
البروتين أساسي لبناء العضلات والاستشفاء، لكن القاعدة هنا:
"الطعام أولًا، والمكمل يُدرس عند تعذر التغطية الغذائية فقط".

متى يعمل؟
داخل generateSupplementAssessment (assessment.ts) في قسم فجوة
البروتين (proteinGap) وقسم البدائل الغذائية.

من يستدعي هذا الملف؟
- supplements/assessment.ts → calculateProteinSupplementGap
  و PROTEIN_FOOD_OPTIONS.

الملفات التي يتعامل معها:
- ./types → ProteinGapResult (شكل النتيجة).
- المدخلات تأتي من أهداف السباح في assessment.ts.

ترتيب العمل:
الاحتياج اليومي + البروتين المتناول من الطعام ↓
حساب العجز ↓
بناء خيارات غذائية تغطي العجز تدريجيًا ↓
هل العجز قابل للتغطية غذائيًا؟ ← عندها صفر مسحوق،
وإلا يُقدَّر الجزء المتبقي بالمسحوق (حد أعلى 60 جم/يوم)

ملاحظة مهمة:
تقديرات استرشادية — الجرعات النهائية للمختص حصرًا، مع توزيع
البروتين على الوجبات وحول التدريب.
==================================================
*/

/**
 * حساب البروتين والمكملات البروتينية:
 * الاحتياج اليومي ← البروتين المستهلك من الطعام ← العجز ←
 * إمكانية تغطيته غذائيًا أولًا ← عندها فقط يُقدَّر جزء المسحوق.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// شكل النتيجة من الأنواع المشتركة (استيراد نوع فقط).
import type { ProteinGapResult } from './types';

// ========================================
// 2. الثوابت
// ========================================

/** مصادر بروتين غذائية شائعة (لكل حصة نموذجية) */
export const PROTEIN_FOOD_OPTIONS: { nameAr: string; grams: number; proteinG: number; calories: number }[] = [
  { nameAr: 'زبادي يوناني (170 جم)', grams: 170, proteinG: 16, calories: 130 },
  { nameAr: 'صدر دجاج مشوي (100 جم)', grams: 100, proteinG: 31, calories: 165 },
  { nameAr: 'جبنة قريش (150 جم)', grams: 150, proteinG: 16, calories: 130 },
  { nameAr: 'بيض مسلوق ×3', grams: 150, proteinG: 18, calories: 234 },
  { nameAr: 'عدس مطبوخ (200 جم)', grams: 200, proteinG: 18, calories: 230 },
  { nameAr: 'تونة بالماء (علبة 100 جم)', grams: 100, proteinG: 24, calories: 116 },
  { nameAr: 'لحم بقري قليل الدهن (120 جم)', grams: 120, proteinG: 26, calories: 180 },
];

// ========================================
// 3. الدالة الرئيسية
// ========================================

/*
-----------------------------------------
الدالة: calculateProteinSupplementGap
-----------------------------------------
وظيفتها: حساب فجوة البروتين واقتراح تغطيتها غذائيًا ثم بالمسحوق.
Input: الاحتياج اليومي + المتناول من الطعام + حد أقصى للمسحوق (افتراضي 60 جم).
Processing:
  1. العجز = الاحتياج - المتناول (لا يسمح بقيم سالبة).
  2. بناء خيارات غذائية تغطي العجز تدريجيًا من قائمة الأطعمة.
  3. إن بقي أقل من 2 جم ← قابل للتغطية غذائيًا (صفر مسحوق).
  4. وإلا: يُقدَّر الجزء المتبقي بالمسحوق (حصص × 25 جم بروتين).
Output: ProteinGapResult (الأرقام + الخيارات + ملاحظة نصية).
يُستدعى من: assessment.ts في قسم البروتين.
-----------------------------------------
*/
/**
 * عند عجز 25 جم مثلًا: يعرض النظام أولًا وجبات طبيعية تغطي العجز،
 * ويوضح أن المكمل يُدرس فقط عند تعذر استكمال الاحتياج غذائيًا.
 */
export function calculateProteinSupplementGap(input: {
  requirementG: number;
  fromFoodG: number;
  maxPowderPerDay?: number;
}): ProteinGapResult {
  const requirementG = Math.max(input.requirementG, 0);
  const fromFoodG = Math.max(input.fromFoodG, 0);
  const deficitG = Math.max(requirementG - fromFoodG, 0);
  const maxPowderPerDay = input.maxPowderPerDay ?? 60; // جم بروتين من المسحوق كحد أعلى

  // خيارات غذائية لتغطية العجز
  const foodOptions: { nameAr: string; grams: number; proteinG: number; calories: number }[] = [];
  let remaining = deficitG;
  for (const opt of PROTEIN_FOOD_OPTIONS) {
    if (remaining <= 0) break;
    const take = Math.min(opt.proteinG, remaining);
    const frac = take / opt.proteinG;
    foodOptions.push({
      nameAr: opt.nameAr,
      grams: Math.round(opt.grams * frac),
      proteinG: Math.round(take),
      calories: Math.round(opt.calories * frac),
    });
    remaining = Math.round((remaining - take) * 10) / 10;
  }

  const gapCoverableByFood = remaining <= 2;
  const supplementPartG = gapCoverableByFood ? 0 : Math.min(remaining, maxPowderPerDay);
  const powderScoops = Math.round((supplementPartG / 25) * 10) / 10;

  const note =
    deficitG <= 0
      ? 'البروتين الغذائي يغطي الاحتياج — لا حاجة لأي مصدر إضافي.'
      : gapCoverableByFood
        ? 'يمكن تغطية العجز من الطعام الطبيعي أولًا؛ لا يُوصى بمكمل بروتيني الآن.'
        : `العجز المتبقي ${supplementPartG} جم يُقدَّر تعويضه جزئيًا بمسحوق بروتين (${powderScoops} حصة × 25 جم بروتين) — للمراجعة المختص حصرًا، مع توزيع البروتين على الوجبات وحول التدريب.`;

  return {
    requirementG,
    fromFoodG,
    deficitG,
    gapCoverableByFood,
    foodOptions,
    supplementPartG,
    powderScoops,
    note,
  };
}
