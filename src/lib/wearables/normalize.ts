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

export type Confidence = 'high' | 'medium' | 'estimated';

export interface NormalizedEnergy {
  activeCalories: number;
  restingCalories: number;
  workoutCalories: number;
  totalCaloriesBurned: number;
  confidence: Confidence;
}

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
    avgHeartRate: raw.avgHeartRate != null ? Math.round(num(raw.avgHeartRate) ?? 0) : undefined,
    restingHeartRate: raw.restingHeartRate != null ? Math.round(num(raw.restingHeartRate) ?? 0) : undefined,
  };
}

/**
 * استخراج مكوّنات الطاقة من بيانات يوم بلا مضاعفة:
 * تُستخدم السعرات النشطة فقط (Active Calories) للتعديل الغذائي.
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
    avgHeartRate: raw.avgHeartRate != null ? Math.round(num(raw.avgHeartRate) ?? 0) : undefined,
    confidence: (raw.confidence as Confidence) ?? (raw.provider ? 'medium' : 'estimated'),
  };
}

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
