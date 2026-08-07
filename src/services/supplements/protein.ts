/**
 * حساب البروتين والمكملات البروتينية:
 * الاحتياج اليومي ← البروتين المستهلك من الطعام ← العجز ←
 * إمكانية تغطيته غذائيًا أولًا ← عندها فقط يُقدَّر جزء المسحوق.
 */
import type { ProteinGapResult } from './types';

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
