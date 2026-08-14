/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/nutrition/calculations.ts

وظيفة الملف:
"محرك الحسابات العلمية" — يحسب كل أرقام الاحتياجات الغذائية:
معدل الأيض الأساسي (BMR)، السعرات اليومية (TDEE)، البروتين،
الكربوهيدرات، الدهون، الماء، الصوديوم، وتوزيع السعرات على الوجبات.

لماذا نحتاجه؟
هذه هي "المعادلات" التي تعتمد عليها صفحة الحاسبة بالكامل.
بدونها لا يوجد أي رقم صحيح تعرضه الحاسبة.

متى تعمل؟
عند استدعاء calculateNutrition من summarizeNutrition
(src/services/nutrition/index.ts) أو مباشرة من واجهات API.

من يستدعي هذا الملف؟
- summarizeNutrition في nutrition/index.ts.
- قد تُستدعى الدوال المساعدة (calcBMI) من أماكن أخرى.

الملفات التي يتعامل معها:
- @/types → NutritionResult و SwimmerFormData.
- nutrition/index.ts → يجمع النتائج مع التوصيات.

المعادلات العلمية:
- Mifflin-St Jeor: 10×وزن + 6.25×طول − 5×عمر (+5 للذكر / −161 للأنثى).
- Katch-McArdle (إن وُجدت نسبة الدهون): 370 + 21.6×الكتلة العضلية.
- عامل النشاط × BMR = TDEE، ثم تضاف سعرات التدريب (MET).
- BMI = الوزن ÷ (الطول بالمتر)².

ترتيب العمل:
مدخلات السباح (عمر/وزن/طول/تدريب...) ↓
حساب BMI و BMR ↓
حساب سعرات التدريب الأسبوعية عبر MET ↓
تجميع TDEE وضبطه حسب الهدف ↓
توزيع المغذيات الكبرى والماء والصوديوم ↓
ترجع NutritionResult كاملة

ملاحظة مهمة:
هذه طبقة "منطق أعمال" وحسابات إرشادية تقديرية،
وليس وصفة علاجية أو تشخيصًا.
==================================================
*/

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
// ========================================
// 1. الاستيرادات
// ========================================

// أنواع مشتركة من مجلد الأنواع الرئيسي: شكل النتيجة وبيانات السباح.
import type { NutritionResult, SwimmerFormData } from '@/types';

// ========================================
// 2. الأنواع والثوابت
// ========================================

/*
-----------------------------------------
النوع: CalcInput
-----------------------------------------
يمثل كل المدخلات التي يحتاجها الحساب من ملف السباح:
الجنس، العمر، الطول، الوزن، مستوى التدريب، عدد الجلسات،
نسبة الدهون، الهدف، وغيرها من الحقول الاختيارية.
-----------------------------------------
*/
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

// MET: قيمة "تكلفة الأيض للتمرين" — رقم قياسي لكل نشاط.
// 1 MET = الطاقة المستهلكة أثناء الجلوس بهدوء. كل نشاط له قيمة معتمدة.
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

// معامل النشاط اليومي: مضاعِف BMR حسب حركة اليوم.
// خامل 1.2 → نشيط جدًا 1.725.
const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  veryActive: 1.725,
} as const;

// ========================================
// 3. الدوال المساعدة (سعرات التدريب)
// ========================================

/** السعرات المستهلكة في التدريب عبر MET */
// المعادلة: سعرات = MET × الوزن × (الدقائق ÷ 60) — أي سعرات الساعة لكل كجم.
export function trainingCalories(
  weightKg: number,
  minutes: number,
  met: number
): number {
  return Math.round((met * weightKg * (minutes / 60)));
}

// تُرجع قيمة MET المناسبة لشدة السباحة (الافتراضي: معتدلة 6.0).
export function swimMet(intensity?: string): number {
  const map: Record<string, number> = MET.swim;
  return map[intensity ?? 'moderate'] ?? MET.swim.moderate;
}

// تُرجع قيمة MET المناسبة لنوع تمرين اللياقة (الافتراضي: مختلط 5.5).
export function gymMet(type?: string): number {
  const map: Record<string, number> = MET.gym;
  return map[type ?? 'mixed'] ?? MET.gym.mixed;
}

// ========================================
// 4. معدل الأيض الأساسي ومؤشر كتلة الجسم
// ========================================

/*
-----------------------------------------
الدالة: calcBMR
-----------------------------------------
وظيفتها: حساب سعرات الجسم في الراحة (أقل طاقة ليعمل الجسم).
Processing:
  - إن وُجدت نسبة دهون صحيحة (2-60%) نستخدم Katch-McArdle
    التي تعتمد على الكتلة العضلية: 370 + 21.6 × (وزن × (1-دهون%)).
  - وإلا نستخدم Mifflin-St Jeor:
    10×وزن + 6.25×طول − 5×عمر، ثم +5 للذكر أو −161 للأنثى.
Output: عدد السعرات (مقرّب).
متى تعمل؟ داخل calculateNutrition.
-----------------------------------------
*/
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
    // الكتلة العضلية = الوزن × (1 − نسبة الدهون).
    const leanMass = input.weightKg * (1 - input.bodyFatPercent / 100);
    return Math.round(370 + 21.6 * leanMass);
  }
  // Mifflin-St Jeor
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  // النساء يحرقن أقل قليلًا (الفرق ثابت في المعادلة).
  const bmr = input.gender === 'female' ? base - 161 : base + 5;
  return Math.round(bmr);
}

/*
-----------------------------------------
الدالة: calcBMI
-----------------------------------------
وظيفتها: حساب مؤشر كتلة الجسم وتصنيفه.
Processing:
  - تحويل الطول إلى متر ثم: الوزن ÷ (الطول²).
  - تصنيف حسب النطاقات العالمية (نقص/طبيعي/زيادة/سمنة).
Output: { bmi (مقرّب)، category }.
-----------------------------------------
*/
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

// ========================================
// 5. ضبط السعرات حسب الهدف
// ========================================

/*
-----------------------------------------
الدالة: adjustCaloriesForGoal
-----------------------------------------
وظيفتها: تعديل السعرات اليومية حسب الهدف المختار.
Processing:
  - خفض الدهون: 85% من TDEE (وللقاصرين 90% حرصًا على النمو).
  - زيادة كتلة: 110%. تحمل/بطولة/زيادة وزن: نسب أصغر من الزيادة.
  - لا هدف: السعرات كما هي.
Output: سعرات يومية مقربة.
-----------------------------------------
*/
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

// ========================================
// 6. البروتين والماء والصوديوم والألياف
// ========================================

// جرام البروتين لكل كجم من الوزن حسب الهدف والمستوى (توصيات رياضية).
export function proteinPerKg(level?: string, goal?: string): number {
  if (goal === 'muscleGain') return 2.0;
  if (level === 'professional' || level === 'competitor' || level === 'advanced') return 2.0;
  return 1.7;
}

// الماء الأساسي: 35 مل لكل كجم من الوزن (إرشاد عام).
export function waterBaseline(weightKg: number): number {
  // 35 مل لكل كجم + أساس صحي
  return Math.round(weightKg * 35);
}

// إضافة الماء بسبب التدريب: 700 مل لكل ساعة تدريب، ×1.3 في الحر.
export function trainingWaterExtra(
  swimMinutes: number,
  gymMinutes: number,
  temp?: string
): number {
  const hot = temp && (temp.includes('حار') || temp.includes('مرتفع')) ? 1.3 : 1;
  const total = ((swimMinutes || 0) + (gymMinutes || 0)) / 60;
  return Math.round(total * 700 * hot);
}

// إرشاد عام للصوديوم: ~1000 ملجم لكل 1000 سعرة + 250 ملجم لكل لتر ماء.
export function calcSodium(calories: number, waterMl: number): number {
  // إرشاد عام: 2000-3000 ملجم + تعويض التعرق
  return Math.round((calories / 1000) * 1000 + (waterMl / 1000) * 250);
}

// الألياف: 14 جم لكل 1000 سعرة، محصور بين 22 و 38 جم.
export function fiberTarget(calories: number): number {
  return Math.round(Math.min(38, Math.max(22, calories / 1000 * 14)));
}

// ========================================
// 7. الدالة الشاملة: الحساب الكامل
// ========================================

/*
-----------------------------------------
الدالة: calculateNutrition
-----------------------------------------
وظيفتها: الدالة الرئيسية التي تجمع كل الحسابات في نتيجة واحدة.
Input: CalcInput (بيانات السباح).
Processing:
  1. حساب BMI و BMR.
  2. تطبيق معامل النشاط اليومي على BMR.
  3. حساب سعرات التدريب الأسبوعية (سباحة + لياقة) وتقسيمها على 7.
  4. TDEE = أساس النشاط + متوسط سعرات التدريب اليومية.
  5. ضبط السعرات حسب الهدف (مع حد أدنى آمن للقاصرين).
  6. توزيع المغذيات: بروتين/دهون/كربوهيدرات (4 و9 سعرات لكل جرام).
  7. حساب الماء والصوديوم والألياف.
  8. توزيع السعرات على الوجبات بنِسب ثابتة.
Output: NutritionResult كاملة بكل الأرقام.
من يستدعيها؟ summarizeNutrition في nutrition/index.ts.
-----------------------------------------
*/
/**
 * الحساب الشامل للاحتياجات.
 * يُحسب TDEE من BMR × عامل النشاط، ثم يضاف متوسط السعرات المستهلكة
 * في التمرين (أسبوعيًا ÷ 7) لأنها تعادل جهدًا رياضيًا إضافيًا.
 */
export function calculateNutrition(input: CalcInput): NutritionResult {
  // نبدأ بمؤشر كتلة الجسم وتصنيفه.
  const { bmi, category } = calcBMI(input.weightKg, input.heightCm);

  // ثم معدل الأيض الأساسي.
  const bmr = calcBMR(input);

  // معامل النشاط اليومي (الافتراضي: معتدل 1.55).
  const activity =
    ACTIVITY_FACTOR[(input.dailyActivityLevel ?? 'moderate') as keyof typeof ACTIVITY_FACTOR] ?? 1.55;

  // عدد دقائق التدريب أسبوعيًا (جلسات × دقائق) لكل نوع.
  const swimWeek = (input.swimSessionsPerWeek ?? 0) * (input.swimMinutesPerSession ?? 0);
  const gymWeek = (input.gymSessionsPerWeek ?? 0) * (input.gymMinutesPerSession ?? 0);
  // السعرات المستهلكة أسبوعيًا في التدريب عبر معادلة MET.
  const swimKcalWeekly =
    swimWeek > 0 ? trainingCalories(input.weightKg, swimWeek, swimMet(input.trainingIntensity)) : 0;
  const gymKcalWeekly = gymWeek > 0 ? trainingCalories(input.weightKg, gymWeek, gymMet(input.gymType)) : 0;

  // متوسط السعرات لكل جلسة (للعرض في النتيجة).
  const swimKcalPerSession = swimWeek > 0 ? Math.round(swimKcalWeekly / (input.swimSessionsPerWeek ?? 1)) : 0;
  const gymKcalPerSession = gymWeek > 0 ? Math.round(gymKcalWeekly / (input.gymSessionsPerWeek ?? 1)) : 0;

  // TDEE = أساس النشاط + متوسط سعرات التدريب اليومي (أسبوعي ÷ 7).
  const tdeeBase = Math.round(bmr * activity);
  const trainingAvgDaily = Math.round((swimKcalWeekly + gymKcalWeekly) / 7);
  const tdee = tdeeBase + trainingAvgDaily;

  // السعرات بعد ضبط الهدف، مع حد أدنى آمن (لا يقل كثيرًا عن BMR).
  const calories = adjustCaloriesForGoal(tdee, input.goal, input.isMinor);
  const safeFloor = Math.round(bmr * 1.15);
  const calorieMin = Math.max(safeFloor, Math.round(calories * 0.9));
  const calorieMax = Math.round(calories * 1.1);

  // المغذيات الكبرى: بروتين ودهون (9 سعرات/جم) ثم ما تبقى كربوهيدرات.
  const proteinPer = proteinPerKg(input.swimmerLevel, input.goal);
  const proteinG = Math.round(input.weightKg * proteinPer);
  const fatG = Math.round(Math.max(0.8 * input.weightKg, (calories * 0.28) / 9));
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const carbsCals = Math.max(0, calories - proteinCals - fatCals);
  const carbsG = Math.round(carbsCals / 4);

  // نسب كل مغذٍ من إجمالي السعرات (للعرض للمستخدم).
  const proteinPct = Math.round((proteinCals / calories) * 100);
  const fatPct = Math.round((fatCals / calories) * 100);
  const carbsPct = Math.round((carbsCals / calories) * 100);

  const fiberG = fiberTarget(calories);

  // الماء: الأساسي + ما يضيفه التدريب.
  const waterMl = waterBaseline(input.weightKg) + trainingWaterExtra(
    input.swimMinutesPerSession ?? 0,
    input.gymMinutesPerSession ?? 0
  );
  const trainingWaterMl = trainingWaterExtra(
    input.swimMinutesPerSession ?? 0,
    input.gymMinutesPerSession ?? 0
  );
  const sodiumMg = calcSodium(calories, waterMl);

  // توزيع السعرات على الوجبات بنِسب مئوية ثابتة (الإفطار 25%، الغداء 25%...).
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

  // تجميع كل النتائج في كائن واحد للعرض.
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
