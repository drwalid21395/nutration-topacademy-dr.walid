/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/normalize.ts

وظيفة الملف:
محرك "التطبيع" (Normalization) — يحوّل أي بيانات خام من أي
ساعة (أسماء حقول متعددة الأشكال) إلى الصيغة الموحّدة، ويستخرج
مكوّنات الطاقة بعناية حتى لا نحسب السعرات مرتين، ويحسب درجة
حمولة التدريب.

لماذا نحتاجه؟
مصادر البيانات مختلفة: كل ساعة تسمي الحقول بأسماء مختلفة
(steps أو steps_count أو steps_counted...). التطبيع يجعل
كل شيء بصيغة واحدة آمنة قبل الدخول إلى قاعدة البيانات.

القاعدة الحرجة:
لا نضيف أو نطرح قيم الساعات كما هي. المزودون يختلفون في
طريقة حساب الإنفاق، وقد يشمل "إجمالي المحروق" سعرات الراحة
(BMR). لذلك نفصل: activeCalories (نشاط فقط — يُعتمد للتعديل
الغذائي)، restingCalories (راحة/BMR)، workoutCalories (سعرات
الجلسات)، totalCaloriesBurned (مجموع الجهاز).

متى يعمل؟
عند كل إدخال بيانات من ساعة (في ingestActivity و ingestWorkouts).

من يستدعيه؟
- src/lib/wearables/sync.ts (خط المزامنة).
- src/lib/nutrition/dynamic.ts (حساب حمولة التدريب).

الملفات التي يتعامل معها:
- ./types: الصيغ الموحّدة UnifiedDailyActivity و UnifiedWorkout.

ترتيب العمل:
normalizeDailyActivity / normalizeWorkout ← extractEnergy ←
computeTrainingLoad
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// من ملف محلي ./types: الصيغ الموحّدة للنشاط والتدريب.
import { UnifiedDailyActivity, UnifiedWorkout } from './types';

/**
 * محرك تطبيع الطاقة (Energy Normalization Engine).
 *
 * القاعدة الحرجة: لا نضيف أو نطرح قيم الساعات كما هي.
 * المزودون يختلفون في طريقة حساب الإنفاق، وقد يشمل «إجمالي المحروق»
 * بالفعل سعرات الراحة (BMR). لذلك:
 *   - activeCalories   = نشاط فقط (خطوات/تدريب) — يُعتمد للتعديل.
 *   - restingCalories  = BMR / راحة.
 *   - workoutCalories  = سعرات الجلسات المسجلة تحديدًا.
 *   - totalCaloriesBurned = مجموع ما يعرضه الجهاز (قد يتضمن BMR).
 */

// ========================================
// 2. الأنواع: الثقة ومكوّنات الطاقة
// ========================================

// Confidence: درجة ثقتنا في القيم — عالية (من بيانات صريحة)
// أو وسط أو تقديرية.
export type Confidence = 'high' | 'medium' | 'estimated';

// NormalizedEnergy: مكوّنات الطاقة الأربعة المفصولة بعناية
// (نشاط / راحة / تدريب / إجمالي الجهاز) + درجة الثقة.
export interface NormalizedEnergy {
  activeCalories: number;
  restingCalories: number;
  workoutCalories: number;
  totalCaloriesBurned: number;
  confidence: Confidence;
}

// ========================================
// 3. تطبيع النشاط اليومي
// ========================================

/*
-----------------------------------------
الدالة: normalizeDailyActivity (مصدَّرة)
-----------------------------------------
وظيفتها: تحويل بيانات نشاط خام من أي مزود إلى النموذج الموحّد.
Input: raw (كائن خام بأي أسماء حقول).
Processing: نمرر كل قيمة عبر num (أرقام موجبة فقط — السالب
            وغير الرقمي يتحول إلى undefined)، ونتقبل عدة أسماء
            للحقل نفسه (مثلاً distanceM أو distance_meters أو distance).
Output: UnifiedDailyActivity.
يستدعيها: sync.ts (في ingestActivity).
-----------------------------------------
*/
/** تحويل بيانات أولية من مزود إلى نموذج موحّد بأمان (أرقام موجبة فقط). */
export function normalizeDailyActivity(raw: Record<string, unknown>): UnifiedDailyActivity {
  const num = (v: unknown): number | undefined => {
    const n = v == null ? undefined : Number(v);
    return n == null || Number.isNaN(n) || n < 0 ? undefined : n;
  };
  return {
    date: new Date((raw.date as string) ?? new Date()),
    steps: raw.steps != null ? Math.round(num(raw.steps) ?? 0) : undefined,
    distanceM: num(raw.distanceM ?? raw.distance_meters ?? raw.distance),
    activeCalories: num(raw.activeCalories ?? raw.active_calories),
    restingCalories: num(raw.restingCalories ?? raw.resting_calories ?? raw.bmr),
    workoutCalories: num(raw.workoutCalories ?? raw.exercise_calories ?? raw.workout_calories),
    totalCaloriesBurned: num(raw.totalCaloriesBurned ?? raw.total_calories_burned ?? raw.calories_out),
    workoutMinutes: raw.workoutMinutes != null ? Math.round(num(raw.workoutMinutes) ?? 0) : undefined,
    sleepMinutes: raw.sleepMinutes != null ? Math.round(num(raw.sleepMinutes) ?? 0) : undefined,
    avgHeartRate: (() => {
      const rawVal = raw.avgHeartRate ?? raw.averageHeartRate ?? raw.heartRate ?? raw.heart_rate ?? raw.average_heart_rate;
      const n = num(rawVal);
      return n != null && n > 0 ? Math.round(n) : undefined;
    })(),
    restingHeartRate: (() => {
      const rawVal = raw.restingHeartRate ?? raw.resting_hr ?? raw.resting_heart_rate;
      const n = num(rawVal);
      return n != null && n > 0 ? Math.round(n) : undefined;
    })(),
    avgSpo2: (() => {
      const rawVal = raw.avgSpo2 ?? raw.spo2 ?? raw.oxygen_saturation ?? raw.oxygenSaturation;
      const n = num(rawVal);
      return n != null && n > 0 && n <= 100 ? Math.round(n) : undefined;
    })(),
  };
}

/**
 * استخراج مكوّنات الطاقة من بيانات يوم بلا مضاعفة:
 * تُستخدم السعرات النشطة فقط (Active Calories) للتعديل الغذائي.
 */

/*
-----------------------------------------
الدالة: extractEnergy (مصدَّرة)
-----------------------------------------
وظيفتها: استخراج مكوّنات الطاقة من بيانات يوم "بلا مضاعفة".
Input: activity (نشاط يوم موحّد).
Processing: نأخذ كل مكوّن على حدة؛ إن غابت سعرات الراحة نقدّرها
            من (الإجمالي - النشط). لا نضيف القيم فوق بعضها أبدًا
            لأن بعض الأجهزة تعرض النشط ضمن الإجمالي.
Output: NormalizedEnergy مع درجة ثقة (high عندما يتوفر النشط
        والإجمالي صراحةً، وإلا estimated).
يستدعيها: sync.ts (في ingestActivity).
ملاحظة تعليمية:
يمكن كتابة هذا الجزء بطريقة أخرى أكثر احترافية (مثل استبعاد
الصفوف منخفضة الثقة تمامًا)، لكننا سنتركه حاليًا كما هو
حتى لا نغير سلوك المشروع.
-----------------------------------------
*/
export function extractEnergy(activity: UnifiedDailyActivity): NormalizedEnergy {
  const total = activity.totalCaloriesBurned ?? 0;
  const active = activity.activeCalories ?? 0;
  const workout = activity.workoutCalories ?? 0;
  const resting = activity.restingCalories ?? Math.max(0, total - active);

  // احذر: بعض الأجهزة تعرض active مضمنًا في total. نعتمد active الصريح إن وُجد،
  // وإلا نقدّر من النشاط ولا نجمع القيم فوق بعضها.
  const confidence: Confidence =
    activity.activeCalories != null && activity.totalCaloriesBurned != null ? 'high' : 'estimated';

  return {
    activeCalories: Math.max(0, active),
    restingCalories: Math.max(0, resting),
    workoutCalories: Math.max(0, workout),
    totalCaloriesBurned: Math.max(0, total),
    confidence,
  };
}

/*
-----------------------------------------
الدالة: normalizeWorkout (مصدَّرة)
-----------------------------------------
وظيفتها: تطبيع جلسة تدريب خام إلى الصيغة الموحّدة.
Input: raw (كائن خام بأي أسماء حقول).
Processing: مثل تطبيع النشاط — أرقام موجبة فقط + تقبّل عدة
            أسماء للحقل + تحديد نوع الرياضة ودرجة الثقة
            (إن لم يُحدَّد المصدر → 'estimated').
Output: UnifiedWorkout.
يستدعيها: sync.ts (في ingestWorkouts).
-----------------------------------------
*/
/** تطبيع جلسة تدريب أولية إلى الصيغة الموحّدة. */
export function normalizeWorkout(raw: Record<string, unknown>): UnifiedWorkout {
  const num = (v: unknown): number | undefined => {
    const n = v == null ? undefined : Number(v);
    return n == null || Number.isNaN(n) || n < 0 ? undefined : n;
  };
  const sportType = String(raw.sportType ?? raw.activity_type ?? raw.sport ?? 'other');
  return {
    startTime: new Date((raw.startTime as string) ?? raw.start ?? new Date()),
    sportType,
    durationMin: raw.durationMin != null ? Math.round(num(raw.durationMin) ?? 0) : undefined,
    caloriesBurned: num(raw.caloriesBurned ?? raw.calories),
    distanceM: num(raw.distanceM ?? raw.distance_meters),
    intensity: raw.intensity ? String(raw.intensity) : undefined,
    provider: raw.provider ? String(raw.provider) : undefined,
    externalId: raw.externalId ? String(raw.externalId) : undefined,
    laps: raw.laps != null ? Math.round(num(raw.laps) ?? 0) : undefined,
    poolLengthM: num(raw.poolLengthM ?? raw.pool_length),
    strokeType: raw.strokeType ? String(raw.strokeType) : undefined,
    avgPacePer100m: num(raw.avgPacePer100m ?? raw.pace_per_100m),
    swolf: num(raw.swolf),
    avgHeartRate: (() => {
      const rawVal = raw.avgHeartRate ?? raw.averageHeartRate ?? raw.heartRate ?? raw.heart_rate ?? raw.average_heart_rate;
      const n = num(rawVal);
      return n != null && n > 0 ? Math.round(n) : undefined;
    })(),
    confidence: (raw.confidence as Confidence) ?? (raw.provider ? 'medium' : 'estimated'),
  };
}

/*
-----------------------------------------
الدالة: computeTrainingLoad (مصدَّرة)
-----------------------------------------
وظيفتها: حساب "درجة حمولة التدريب" من البيانات الفعلية
         (خطوات + دقائق تدريب + مسافة سباحة) — وليس من السعرات
         وحدها. تُستخدم في الرسائل وتعديل الهدف الغذائي.
Input: activity (نشاط اليوم) + workouts (تدريبات اليوم).
Processing: نجمع نقاطًا: الخطوات (حتى 25)، دقائق التدريب (حتى 40)،
            ومسافة السباحة (حتى 15). ثم نحول المجموع إلى تصنيف:
            veryHigh / hard / moderate / light / rest.
Output: { label, score } حيث score من 0 إلى 100.
يستدعيها: dynamic.ts و sync.ts.
-----------------------------------------
*/
/** درجة تحميل التدريب من البيانات الفعلية (وليس من السعرات وحدها). */
export function computeTrainingLoad(activity: UnifiedDailyActivity, workouts: UnifiedWorkout[]): { label: string; score: number } {
  const totalWorkoutMin = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const swimDistance = workouts.filter((w) => w.sportType === 'swim').reduce((a, w) => a + (w.distanceM ?? 0), 0);
  const steps = activity.steps ?? 0;

  let score = 0;
  if (steps > 12000) score += 25;
  else if (steps > 8000) score += 18;
  else if (steps > 4000) score += 10;
  else score += 4;

  score += Math.min(40, Math.round(totalWorkoutMin / 15));
  if (swimDistance > 2000) score += 15;
  else if (swimDistance > 1000) score += 10;
  else if (swimDistance > 0) score += 5;

  const label =
    score >= 75 ? 'veryHigh' : score >= 55 ? 'hard' : score >= 35 ? 'moderate' : score >= 18 ? 'light' : 'rest';
  return { label, score: Math.min(100, score) };
}
