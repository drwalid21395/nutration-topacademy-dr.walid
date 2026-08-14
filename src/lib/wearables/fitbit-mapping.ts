/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/fitbit-mapping.ts

وظيفة الملف:
"قاموس الترجمة" الخاص بـ Fitbit — يستقبل البيانات الخام
التي ترسلها Fitbit (بأسماء حقولها الخاصة) ويعيدها بصيغة
الموقع الموحّدة. مثال: اسم النشاط "Lap Swimming" يتحول إلى
sportType = 'swim'، والمدة من مللي ثانية إلى دقائق.

لماذا نحتاجه؟
Fitbit لا تعرف لغتنا (صيغتنا الموحّدة)، ونحن لا نريد أن نلمس
تفاصيلها في كل مكان. كل ترجمة Fitbit هنا في هذا الملف وحده.

لماذا هذا الملف "نقي" (بدون تبعيات)؟
الدوال هنا لا تستدعي قاعدة البيانات ولا الساعة — فقط تحوّل
كائنًا إلى كائن. هذا يجعلها سهلة الاختبار (ملف .test.ts مرافق).

متى يعمل؟
عند مزامنة Fitbit (في fitbit.ts) لكل يوم ولكل تمرين.

من يستدعيه؟
- src/lib/wearables/fitbit.ts (جالب Fitbit).
- src/lib/wearables/fitbit-mapping.test.ts (الاختبارات).

الملفات التي يتعامل معها:
- لا يستورد من أي ملف — دوال خالصة (Pure Functions).
  يبني صورتها من واجهة Fitbit API v1.

ترتيب العمل:
استجابة Fitbit ← دوال map* ← صيغة موحّدة تفهمها normalize.ts
=================================================
*/

// ========================================
// 1. تصنيف الرياضة وتحويل الوحدات
// ========================================

/**
 * تحويلات Fitbit النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 * Fitbit API v1: https://dev.fitbit.com/build/reference/web-api/
 */

/*
-----------------------------------------
الدالة: mapFitbitSport
-----------------------------------------
وظيفتها: تصنيف نشاط Fitbit (من اسمه أو activityTypeId)
         إلى صيغتنا الموحّدة: swim / run / cycle / walk / gym / other.
Input: name (اسم النشاط) + activityTypeId اختياري (معرّف Fitbit).
Processing: نفحص الاسم بعد تحويله لأحرف كبيرة ونبحث عن كلمات
            (SWIM, RUN...) أو نطابق معرّفات النوع المعروفة.
Output: نص النوع الموحّد.
يستدعيها: mapFitbitWorkout.
-----------------------------------------
*/
/** تصنيف نشاط Fitbit إلى صيغتنا الموحّدة من الاسم ونوع النشاط. */
export function mapFitbitSport(name: string, activityTypeId?: number): string {
  const n = (name ?? '').toUpperCase();
  if (n.includes('SWIM') || activityTypeId === 1357 || activityTypeId === 296) return 'swim';
  if (n.includes('RUN') || activityTypeId === 9009 || activityTypeId === 1227) return 'run';
  if (n.includes('CYCL') || n.includes('BIKE') || n.includes('SPIN')) return 'cycle';
  if (n.includes('WALK') || n.includes('HIKE') || activityTypeId === 9) return 'walk';
  if (
    n.includes('WEIGHT') ||
    n.includes('GYM') ||
    n.includes('FITNESS') ||
    n.includes('CIRCUIT') ||
    n.includes('TRAINER') ||
    n.includes('CROSSFIT') ||
    n.includes('CORE') ||
    n.includes('STRENGTH') ||
    n.includes('YOGA')
  ) {
    return 'gym';
  }
  return 'other';
}

/*
-----------------------------------------
الدالة: parseFitbitDuration
-----------------------------------------
وظيفتها: تحويل مدة Fitbit من مللي ثانية إلى دقائق.
Input: ms (قد تكون null/undefined).
Processing: نتجاهل القيم السالبة وغير الرقمية ونقرّب لأقرب دقيقة.
Output: عدد الدقائق، أو undefined عندما تكون القيمة غير صالحة.
يستدعيها: mapFitbitWorkout.
-----------------------------------------
*/
/** مدة Fitbit (مللي ثانية) → دقائق. */
export function parseFitbitDuration(ms: number | null | undefined): number | undefined {
  if (ms == null) return undefined;
  const n = Number(ms);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n / 60000);
}

/*
-----------------------------------------
الدالة: fitbitDistanceToMeters
-----------------------------------------
وظيفتها: تحويل مسافة Fitbit من كيلومتر إلى متر.
Input: km (قد تكون null/undefined).
Processing: نتجاهل القيم السالبة وغير الرقمية، ثم نضرب في 1000.
Output: المسافة بالمتر، أو undefined.
يستدعيها: mapFitbitWorkout.
-----------------------------------------
*/
/** مسافة Fitbit (كم) → متر. */
export function fitbitDistanceToMeters(km: number | null | undefined): number | undefined {
  if (km == null) return undefined;
  const n = Number(km);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n * 1000);
}

// ========================================
// 2. تحويل استجابات Fitbit إلى الصيغة الموحّدة
// ========================================

/*
-----------------------------------------
الدالة: mapFitbitActivitySummary
-----------------------------------------
وظيفتها: تحويل ملخص نشاط اليوم من Fitbit إلى الصيغة الموحّدة.
Input: raw (استجابة /activities/date/{date}.json).
Processing: نقرأ من summary الخطوات والسعرات (النشطة/الراحة/الكلي)
            والمسافات، ونحسب دقائق النشاط من الدقائق النشطة.
            القيم الصفرية تُحوَّل إلى undefined كي لا نكتب أصفارًا مضللة.
Output: كائن بالصيغة الموحّدة (steps, distanceM, activeCalories...).
يستدعيها: fitbit.ts (لكل يوم من أيام المزامنة).
-----------------------------------------
*/
/** تحويل سجل نشاط Fitbit → صيغة النشاط الموحّدة. */
export function mapFitbitActivitySummary(raw: Record<string, unknown>): Record<string, unknown> {
  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const activityCalories = (summary.activityCalories as number | undefined) ?? 0;
  const caloriesOut = (summary.caloriesOut as number | undefined) ?? 0;
  const bmr = (summary.caloriesBMR as number | undefined) ?? 0;
  const sedentaryMin = (summary.sedentaryMinutes as number | undefined) ?? 0;
  const fairlyMin = (summary.fairlyActiveMinutes as number | undefined) ?? 0;
  const veryMin = (summary.veryActiveMinutes as number | undefined) ?? 0;
  const lightlyMin = (summary.lightlyActiveMinutes as number | undefined) ?? 0;

  const steps = (summary.steps as number | undefined) ?? 0;
  const distances = (summary.distances as Array<{ distance?: number }> | undefined) ?? [];
  const distance = distances.find((d) => d.distance != null);

  return {
    steps,
    distanceM: distance?.distance != null ? Math.round(distance.distance * 1000) : undefined,
    activeCalories: activityCalories > 0 ? activityCalories : undefined,
    restingCalories: bmr > 0 ? bmr : undefined,
    workoutCalories: undefined,
    totalCaloriesBurned: caloriesOut > 0 ? caloriesOut : undefined,
    workoutMinutes: fairlyMin + veryMin + lightlyMin > 0 ? fairlyMin + veryMin + lightlyMin : undefined,
    sedentaryMinutes: sedentaryMin,
  };
}

/*
-----------------------------------------
الدالة: mapFitbitSleep
-----------------------------------------
وظيفتها: استخراج دقائق النوم ومعدل نبض الراحة من استجابة النوم.
Input: raw (استجابة /sleep/date/{date}.json).
Processing: نقرأ totalMinutesAsleep و restingHeartRate من summary.
Output: كائن قد يحتوي sleepMinutes و/أو restingHeartRate.
يستدعيها: fitbit.ts (لكل يوم).
-----------------------------------------
*/
/** استخراج دقائق النوم ومعدل نبض الراحة من استجابة نوم Fitbit. */
export function mapFitbitSleep(raw: Record<string, unknown>): { sleepMinutes?: number; restingHeartRate?: number } {
  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const asleep = summary.totalMinutesAsleep as number | undefined;
  const rhr = summary.restingHeartRate as number | undefined;
  const out: { sleepMinutes?: number; restingHeartRate?: number } = {};
  if (asleep != null && asleep > 0) out.sleepMinutes = Math.round(asleep);
  if (rhr != null && rhr > 0) out.restingHeartRate = Math.round(rhr);
  return out;
}

/*
-----------------------------------------
الدالة: mapFitbitHeart
-----------------------------------------
وظيفتها: استخراج معدل نبض الراحة من استجابة النبض اليومية.
Input: raw (استجابة /activities/heart/date/{date}/1d.json).
Processing: نقرأ أول عنصر من activities-heart.
Output: { restingHeartRate } أو كائن فارغ إن لم يوجد.
يستدعيها: fitbit.ts (لكل يوم).
-----------------------------------------
*/
/** استخراج معدل نبض الراحة من استجابة النبض اليومية. */
export function mapFitbitHeart(raw: Record<string, unknown>): { restingHeartRate?: number } {
  const list = (raw['activities-heart'] as Array<{ value?: { restingHeartRate?: number } }> | undefined) ?? [];
  const rhr = list[0]?.value?.restingHeartRate;
  if (rhr != null && rhr > 0) return { restingHeartRate: Math.round(rhr) };
  return {};
}

/*
-----------------------------------------
الدالة: mapFitbitWorkout
-----------------------------------------
وظيفتها: تحويل سجل تمرين من قائمة النشاطات إلى صيغة التدريب الموحّدة.
Input: raw (عنصر من /activities/list.json).
Processing: نصنّف الرياضة ونحول المدة (ms → دقائق) والمسافة
            (كم → متر) ونبني externalId بصيغة fitbit-<logId>.
Output: كائن بالصيغة الموحّدة للتدريب.
يستدعيها: fitbit.ts (في getWorkouts).
ماذا تستدعي: mapFitbitSport + parseFitbitDuration + fitbitDistanceToMeters.
-----------------------------------------
*/
/** تحويل سجل نشاط/تمرين من قائمة النشاطات إلى صيغة التدريب الموحّدة. */
export function mapFitbitWorkout(raw: Record<string, unknown>): Record<string, unknown> {
  const name = String(raw.name ?? raw.activityName ?? '');
  const activityTypeId = raw.activityTypeId != null ? Number(raw.activityTypeId) : undefined;
  const startTime = String(raw.startTime ?? '');
  const calories = raw.calories != null ? Number(raw.calories) : undefined;
  const distanceKm = raw.distance != null ? Number(raw.distance) : undefined;

  return {
    sportType: mapFitbitSport(name, activityTypeId),
    startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
    durationMin: parseFitbitDuration(raw.duration as number | null | undefined),
    caloriesBurned: calories && calories > 0 ? Math.round(calories) : undefined,
    distanceM: fitbitDistanceToMeters(distanceKm),
    externalId: raw.logId != null ? `fitbit-${raw.logId}` : undefined,
  };
}
