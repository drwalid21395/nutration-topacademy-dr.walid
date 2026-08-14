/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/types/index.ts

وظيفة الملف:
تعريف "أشكال البيانات" (أنواع TypeScript) التي يتشاركها كثير
من الملفات: بيانات نموذج السباح، نتائج الحساب الغذائي، تحليل
الوجبات، وتفضيلات الإشعارات.

لماذا نحتاجه؟
نحتاج شكلاً واحدًا ثابتًا للبيانات حتى لا تختلف أسماء الحقول بين
ملف وآخر (مثلاً weightKg لا يُكتب في مكان آخر weight). أي ملف
يخالف الشكل يُكتشف خطؤه في المحرر قبل تشغيل الموقع.

من يستخدمه؟
كل الصفحات وواجهات API التي تتعامل مع نموذج السباح أو نتائج
الحساب أو تحليل الوجبات أو إعدادات الإشعارات.

ملاحظة:
ملف "أنواع" فقط — لا يحتوي على كود يُنفَّذ وقت التشغيل.
=================================================
*/

// ========================================
// 1. أدوار المستخدمين
// ========================================

// Role: نوع بسيط (Union) يحصر الدور في القيم الخمس المذكورة فقط.
// الفائدة: لا يمكن تمرير أي نص آخر كدور بطريق الخطأ.
export type Role = 'athlete' | 'guardian' | 'coach' | 'dietitian' | 'admin';

// SwimmerFormData: كل الحقول التي يجمعها نموذج بيانات السباح
// (الاستمارة). أغلب الحقول اختيارية (علامة ?) لأن السباح قد لا
// يكمل كل الخانات في البداية، والحقول الإلزامية فقط بدون علامة.
export interface SwimmerFormData {
  // أساسية
  fullName: string;
  gender: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  country?: string;
  timezone?: string;
  ageGroup?: string;
  swimmerLevel?: string;
  specialty?: string;
  mainDistances?: string;
  personalBests?: string;
  nextCompetitionDate?: string;

  // تدريب
  swimSessionsPerWeek?: number;
  swimMinutesPerSession?: number;
  trainingIntensity?: string;
  swimDistancePerSession?: number;
  gymSessionsPerWeek?: number;
  gymMinutesPerSession?: number;
  gymType?: string;
  restDays?: string;
  trainingTime?: string;
  hasDoubleTraining: boolean;
  sleepHours?: number;
  dailyActivityLevel?: string;

  // غذاء وصحة
  goal?: string;
  allergies?: string;
  dislikedFoods?: string;
  dietType?: string;
  preferredMealsPerDay?: number;
  budgetLevel?: string;
  availableFoods?: string;
  chronicConditions?: string;
  medications?: string;
  currentInjuries?: string;
  digestiveIssues?: string;
  pregnancyStatus?: string;
  isMinor: boolean;
  guardianName?: string;
  guardianPhone?: string;
  notes?: string;
}

// NutritionResult: نتائج الحساب الغذائي (مؤشر كتلة الجسم BMI،
// معدل الأيض BMR، السعرات اليومية، الماكروز، الماء...).
// كل الحقول اختيارية لأن النتائج تختلف حسب البيانات المتوفرة.
export interface NutritionResult {
  bmi?: number;
  bmiCategory?: string;
  bmr?: number;
  tdee?: number;
  calories?: number;
  calorieMin?: number;
  calorieMax?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  waterMl?: number;
  trainingWaterMl?: number;
  sodiumMg?: number;
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  mealCalories?: Record<string, number>;
  trainingCalories?: { swimKcal?: number; gymKcal?: number; total?: number };
  formula?: string;
  recommendations?: Record<string, string>;
}

// AnalyzedFood: شكل "غذاء واحد" بعد تحليل الوجبة (اسم بالعربي
// + قيم غذائية اختيارية).
export interface AnalyzedFood {
  nameAr: string;
  nameEn?: string;
  grams?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sodiumMg?: number;
}

// MealAnalysisResult: نتيجة تحليل وجبة كاملة — مصدر التحليل
// (provider) + هل هي تقديرية (isEstimate) + مجموع القيم لكل الأطعمة.
export interface MealAnalysisResult {
  provider: string;
  isEstimate: boolean;
  confidence?: number;
  foods: AnalyzedFood[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  totalSodiumMg: number;
  needsReview?: boolean;
  notes?: string;
  raw?: unknown;
}

// NotificationPrefForm: تفضيلات إشعارات المستخدم — أوقات الوجبات،
// فترات الماء، إعدادات الصوت والوضع الصامت، وأزرار التفعيل.
export interface NotificationPrefForm {
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  snackTimes?: string;
  preWorkoutTime?: string;
  postWorkoutTime?: string;
  waterInterval?: number;
  trainingTime?: string;
  sleepTime?: string;
  weighInTime?: string;
  competitionReminderDays?: number;
  planReviewReminderDays?: number;
  soundEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  smartAlerts: boolean;
  days?: string;
}
