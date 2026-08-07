/**
 * محرك حساب الاحتياجات الغذائية — معادلات علمية منفصلة وقابلة للتحديث.
 *
 * المصادر المعتمدة:
 * - Mifflin-St Jeor لحساب BMR
 * - Katch-McArdle عند توفر نسبة الدهون
 * - عامل النشاط × BMR = TDEE
 * - سعرات التمرين عبر METs
 * - توصيات ISSA / ISSN / ACSM للمغذيات الكبرى لدى الرياضيين
 */
import type { NutritionResult, SwimmerFormData } from '@/types';

export interface CalcInput {
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  goal?: string;
  swimmerLevel?: string;
  swimSessionsPerWeek?: number;
  swimMinutesPerSession?: number;
  trainingIntensity?: string;
  gymSessionsPerWeek?: number;
  gymMinutesPerSession?: number;
  gymType?: string;
  dailyActivityLevel?: string;
  preferredMealsPerDay?: number;
  isMinor?: boolean;
}

const MET = {
  swim: { low: 4.5, moderate: 6.0, high: 8.3, veryHigh: 10.0 },
  gym: {
    resistance: 4.0,
    strength: 4.0,
    endurance: 6.0,
    flexibility: 3.0,
    speed: 6.5,
    mixed: 5.5,
  },
} as const;

const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  veryActive: 1.725,
} as const;

/** السعرات المستهلكة في التدريب عبر MET */
export function trainingCalories(
  weightKg: number,
  minutes: number,
  met: number
): number {
  return Math.round((met * weightKg * (minutes / 60)));
}

export function swimMet(intensity?: string): number {
  const map: Record<string, number> = MET.swim;
  return map[intensity ?? 'moderate'] ?? MET.swim.moderate;
}

export function gymMet(type?: string): number {
  const map: Record<string, number> = MET.gym;
  return map[type ?? 'mixed'] ?? MET.gym.mixed;
}

/** حساب معدل الأيض الأساسي BMR */
export function calcBMR(input: {
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
}): number {
  if (input.bodyFatPercent && input.bodyFatPercent > 2 && input.bodyFatPercent < 60) {
    // Katch-McArdle (يتطلب نسبة دهون)
    const leanMass = input.weightKg * (1 - input.bodyFatPercent / 100);
    return Math.round(370 + 21.6 * leanMass);
  }
  // Mifflin-St Jeor
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const bmr = input.gender === 'female' ? base - 161 : base + 5;
  return Math.round(bmr);
}

/** حساب مؤشر كتلة الجسم */
export function calcBMI(weightKg: number, heightCm: number): { bmi: number; category: string } {
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  let category = 'وزن طبيعي';
  if (bmi < 18.5) category = 'نقص في الوزن';
  else if (bmi < 25) category = 'وزن طبيعي';
  else if (bmi < 30) category = 'زيادة في الوزن';
  else category = 'سمنة';
  return { bmi: Math.round(bmi * 10) / 10, category };
}

/** تحديد الكتلة المالية المعتمدة اعتمادًا على نسبة الدهون العضلية */
export function adjustCaloriesForGoal(tdee: number, goal?: string, isMinor?: boolean): number {
  switch (goal) {
    case 'fatLoss': {
      const target = tdee * 0.85;
      // للقاصرين نخفف النسبة حرصًا على النمو الصحي
      return Math.round(isMinor ? tdee * 0.9 : target);
    }
    case 'muscleGain':
      return Math.round(tdee * 1.1);
    case 'endurance':
      return Math.round(tdee * 1.08);
    case 'competition':
      return Math.round(tdee * 1.05);
    case 'weightGain':
      return Math.round(tdee * 1.12);
    default:
      return Math.round(tdee);
  }
}

export function proteinPerKg(level?: string, goal?: string): number {
  if (goal === 'muscleGain') return 2.0;
  if (level === 'professional' || level === 'competitor' || level === 'advanced') return 2.0;
  return 1.7;
}

export function waterBaseline(weightKg: number): number {
  // 35 مل لكل كجم + أساس صحي
  return Math.round(weightKg * 35);
}

export function trainingWaterExtra(
  swimMinutes: number,
  gymMinutes: number,
  temp?: string
): number {
  const hot = temp && (temp.includes('حار') || temp.includes('مرتفع')) ? 1.3 : 1;
  const total = ((swimMinutes || 0) + (gymMinutes || 0)) / 60;
  return Math.round(total * 700 * hot);
}

export function calcSodium(calories: number, waterMl: number): number {
  // إرشاد عام: 2000-3000 ملجم + تعويض التعرق
  return Math.round((calories / 1000) * 1000 + (waterMl / 1000) * 250);
}

export function fiberTarget(calories: number): number {
  return Math.round(Math.min(38, Math.max(22, calories / 1000 * 14)));
}

/**
 * الحساب الشامل للاحتياجات.
 * يُحسب TDEE من BMR × عامل النشاط، ثم يضاف متوسط السعرات المستهلكة
 * في التمرين (أسبوعيًا ÷ 7) لأنها تعادل جهدًا رياضيًا إضافيًا.
 */
export function calculateNutrition(input: CalcInput): NutritionResult {
  const { bmi, category } = calcBMI(input.weightKg, input.heightCm);

  const bmr = calcBMR(input);

  const activity =
    ACTIVITY_FACTOR[(input.dailyActivityLevel ?? 'moderate') as keyof typeof ACTIVITY_FACTOR] ?? 1.55;

  const swimWeek = (input.swimSessionsPerWeek ?? 0) * (input.swimMinutesPerSession ?? 0);
  const gymWeek = (input.gymSessionsPerWeek ?? 0) * (input.gymMinutesPerSession ?? 0);
  const swimKcalWeekly =
    swimWeek > 0 ? trainingCalories(input.weightKg, swimWeek, swimMet(input.trainingIntensity)) : 0;
  const gymKcalWeekly = gymWeek > 0 ? trainingCalories(input.weightKg, gymWeek, gymMet(input.gymType)) : 0;

  const swimKcalPerSession = swimWeek > 0 ? Math.round(swimKcalWeekly / (input.swimSessionsPerWeek ?? 1)) : 0;
  const gymKcalPerSession = gymWeek > 0 ? Math.round(gymKcalWeekly / (input.gymSessionsPerWeek ?? 1)) : 0;

  const tdeeBase = Math.round(bmr * activity);
  const trainingAvgDaily = Math.round((swimKcalWeekly + gymKcalWeekly) / 7);
  const tdee = tdeeBase + trainingAvgDaily;

  const calories = adjustCaloriesForGoal(tdee, input.goal, input.isMinor);
  const safeFloor = Math.round(bmr * 1.15);
  const calorieMin = Math.max(safeFloor, Math.round(calories * 0.9));
  const calorieMax = Math.round(calories * 1.1);

  // المغذيات الكبرى
  const proteinPer = proteinPerKg(input.swimmerLevel, input.goal);
  const proteinG = Math.round(input.weightKg * proteinPer);
  const fatG = Math.round(Math.max(0.8 * input.weightKg, (calories * 0.28) / 9));
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const carbsCals = Math.max(0, calories - proteinCals - fatCals);
  const carbsG = Math.round(carbsCals / 4);

  const proteinPct = Math.round((proteinCals / calories) * 100);
  const fatPct = Math.round((fatCals / calories) * 100);
  const carbsPct = Math.round((carbsCals / calories) * 100);

  const fiberG = fiberTarget(calories);

  // الماء
  const waterMl = waterBaseline(input.weightKg) + trainingWaterExtra(
    input.swimMinutesPerSession ?? 0,
    input.gymMinutesPerSession ?? 0
  );
  const trainingWaterMl = trainingWaterExtra(
    input.swimMinutesPerSession ?? 0,
    input.gymMinutesPerSession ?? 0
  );
  const sodiumMg = calcSodium(calories, waterMl);

  // توزيع السعرات على الوجبات
  const meals = Math.min(8, Math.max(3, input.preferredMealsPerDay ?? 5));
  const mealShare = [0.25, 0.15, 0.2, 0.25, 0.15];
  const mealCalories: Record<string, number> = {};
  const mealTypes = [
    'breakfast', 'snack1', 'preWorkout', 'lunch', 'duringWorkout',
    'postWorkout', 'dinner', 'snack2', 'supper',
  ];
  for (let i = 0; i < meals; i++) {
    const share = i < mealShare.length ? mealShare[i] : 0.1;
    mealCalories[mealTypes[i]] = Math.round((calories * share) / 5) * 5;
  }

  return {
    bmi,
    bmiCategory: category,
    bmr,
    tdee,
    calories,
    calorieMin,
    calorieMax,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    waterMl,
    trainingWaterMl,
    sodiumMg,
    proteinPct,
    carbsPct,
    fatPct,
    mealCalories,
    trainingCalories: {
      swimKcal: swimKcalPerSession,
      gymKcal: gymKcalPerSession,
      total: Math.round((swimKcalWeekly + gymKcalWeekly) / 7),
    },
    formula: 'Mifflin-St Jeor + Katch-McArdle + MET activity',
    recommendations: {},
  };
}
