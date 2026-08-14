/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/oura-mapping.ts

وظيفة الملف:
"قاموس الترجمة" الخاص بـ Oura — يستقبل البيانات الخام من
Oura Cloud API v2 ويعيدها بالصيغة الموحّدة للموقع:
تصنيف الرياضة، تحويل الثواني إلى دقائق، وتحويل سجلات
النشاط والنوم والتدريب.

لماذا نحتاجه؟
Oura تسمّي الحقول بصيغتها الخاصة (distance_meters,
calories_active, total_sleep_duration...). نحن لا نريد
تلمّس هذه الأسماء في باقي المشروع — كل الترجمة هنا.

لماذا "نقي" (بدون تبعيات)؟
الدوال خالصة: كائن يدخل وكائن يخرج دون لمس قاعدة البيانات.
هذا يجعلها سهلة الاختبار (ملف .test.ts مرافق).

متى يعمل؟
عند مزامنة Oura (في oura.ts) لكل يوم ولكل تمرين.

من يستدعيه؟
- src/lib/wearables/oura.ts (جالب Oura).
- src/lib/wearables/oura-mapping.test.ts (الاختبارات).

الملفات التي يتعامل معها:
- لا يستورد من أي ملف — دوال خالصة.
  يبني صورته من واجهة Oura Cloud API v2.

ترتيب العمل:
استجابة Oura ← دوال map* ← صيغة موحّدة تفهمها normalize.ts
=================================================
*/

// ========================================
// 1. تصنيف الرياضة وتحويل الوحدات
// ========================================

/**
 * تحويلات Oura النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 * Oura Cloud API v2: https://cloud.ouraring.com/docs
 */

/*
-----------------------------------------
الدالة: mapOuraSport
-----------------------------------------
وظيفتها: تصنيف نشاط Oura من اسم التمرين إلى صيغتنا الموحّدة.
Input: activity (اسم النشاط كنص).
Processing: نفحص الاسم بعد تحويله لأحرف كبيرة ونبحث عن كلمات
            (SWIM, RUN, CYCL...).
Output: swim / run / cycle / walk / gym / other.
يستدعيها: mapOuraWorkout.
-----------------------------------------
*/
/** تصنيف نشاط Oura من اسم نشاط التمرين → صيغتنا الموحّدة. */
export function mapOuraSport(activity: string): string {
  const a = (activity ?? '').toUpperCase();
  if (a.includes('SWIM')) return 'swim';
  if (a.includes('RUN')) return 'run';
  if (a.includes('CYCL') || a.includes('BIKE') || a.includes('SPIN')) return 'cycle';
  if (a.includes('WALK') || a.includes('HIKE')) return 'walk';
  if (
    a.includes('WEIGHT') ||
    a.includes('GYM') ||
    a.includes('FITNESS') ||
    a.includes('CIRCUIT') ||
    a.includes('TRAINER') ||
    a.includes('CROSSFIT') ||
    a.includes('CORE') ||
    a.includes('STRENGTH') ||
    a.includes('YOGA')
  ) {
    return 'gym';
  }
  return 'other';
}

/*
-----------------------------------------
الدالة: ouraSecondsToMinutes
-----------------------------------------
وظيفتها: تحويل الثواني إلى دقائق (Oura ترسل المدد بالثواني).
Input: seconds (قد تكون null/undefined).
Processing: نتجاهل القيم السالبة وغير الرقمية ونقرّب لأقرب دقيقة.
Output: الدقائق، أو undefined.
يستدعيها: mapOuraDailySleep و mapOuraWorkout.
-----------------------------------------
*/
/** ثوانٍ → دقائق. */
export function ouraSecondsToMinutes(seconds: number | null | undefined): number | undefined {
  if (seconds == null) return undefined;
  const n = Number(seconds);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n / 60);
}

// ========================================
// 2. تحويل استجابات Oura إلى الصيغة الموحّدة
// ========================================

/*
-----------------------------------------
الدالة: mapOuraDailyActivity
-----------------------------------------
وظيفتها: تحويل سجل نشاط يومي من Oura إلى الصيغة الموحّدة.
Input: raw (عنصر من /usercollection/daily_activity).
Processing: نقرأ الخطوات والمسافة (بالمتر) والسعرات (نشطة/راحة/
            كلية) ومتوسط النبض. سعرات التدريب نحسبها كالفرق بين
            الكلية والنشطة والراحة (بلا مضاعفة).
Output: كائن بالصيغة الموحّدة.
يستدعيها: oura.ts (لكل يوم).
-----------------------------------------
*/
/** تحويل سجل نشاط يومي Oura → صيغة النشاط الموحّدة. */
export function mapOuraDailyActivity(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    steps: raw.steps != null ? Math.round(Number(raw.steps) || 0) : undefined,
    distanceM: raw.distance_meters != null ? Math.round(Number(raw.distance_meters) || 0) : undefined,
    activeCalories: raw.calories_active != null ? Math.round(Number(raw.calories_active) || 0) : undefined,
    restingCalories: raw.calories_resting != null ? Math.round(Number(raw.calories_resting) || 0) : undefined,
    workoutCalories: raw.calories_total != null && raw.calories_active != null ? Math.max(0, Math.round(Number(raw.calories_total) - Number(raw.calories_active) - Number(raw.calories_resting ?? 0))) : undefined,
    totalCaloriesBurned: raw.calories_total != null ? Math.round(Number(raw.calories_total) || 0) : undefined,
    avgHeartRate: raw.average_heart_rate != null ? Math.round(Number(raw.average_heart_rate) || 0) : undefined,
  };
}

/*
-----------------------------------------
الدالة: mapOuraDailySleep
-----------------------------------------
وظيفتها: استخراج النوم ومعدلات النبض من سجل نوم Oura.
Input: raw (عنصر من /usercollection/daily_sleep).
Processing: نحول مدة النوم من ثوانٍ إلى دقائق، ونقرأ متوسط
            النبض ونبض الراحة.
Output: كائن قد يحتوي sleepMinutes و/أو avgHeartRate
        و/أو restingHeartRate.
يستدعيها: oura.ts (لكل يوم).
ماذا تستدعي: ouraSecondsToMinutes.
-----------------------------------------
*/
/** استخراج النوم ومعدل نبض الراحة من سجل نوم Oura. */
export function mapOuraDailySleep(raw: Record<string, unknown>): { sleepMinutes?: number; avgHeartRate?: number; restingHeartRate?: number } {
  const out: { sleepMinutes?: number; avgHeartRate?: number; restingHeartRate?: number } = {};
  const asleep = ouraSecondsToMinutes(raw.total_sleep_duration as number | null | undefined);
  if (asleep != null && asleep > 0) out.sleepMinutes = asleep;
  if (raw.average_heart_rate != null && Number(raw.average_heart_rate) > 0) {
    out.avgHeartRate = Math.round(Number(raw.average_heart_rate));
  }
  if (raw.resting_heart_rate != null && Number(raw.resting_heart_rate) > 0) {
    out.restingHeartRate = Math.round(Number(raw.resting_heart_rate));
  }
  return out;
}

/*
-----------------------------------------
الدالة: mapOuraWorkout
-----------------------------------------
وظيفتها: تحويل تمرين Oura إلى صيغة التدريب الموحّدة.
Input: raw (عنصر من /usercollection/workout).
Processing: نصنّف الرياضة ونحول المدة (ثوانٍ → دقائق) ونقرأ
            السعرات والمسافة والنبض، ونبني externalId بصيغة oura-<id>.
Output: كائن بالصيغة الموحّدة.
يستدعيها: oura.ts (في getWorkouts).
ماذا تستدعي: mapOuraSport + ouraSecondsToMinutes.
-----------------------------------------
*/
/** تحويل تمرين Oura → صيغة التدريب الموحّدة. */
export function mapOuraWorkout(raw: Record<string, unknown>): Record<string, unknown> {
  const startTime = String(raw.start_datetime ?? '');
  const calories = raw.calories != null ? Number(raw.calories) : undefined;
  const distanceM = raw.distance_meters != null ? Number(raw.distance_meters) : undefined;
  const hr = raw.average_heart_rate != null ? Number(raw.average_heart_rate) : undefined;

  return {
    sportType: mapOuraSport(String(raw.activity ?? '')),
    startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
    durationMin: ouraSecondsToMinutes(raw.duration as number | null | undefined),
    caloriesBurned: calories != null && calories > 0 ? Math.round(calories) : undefined,
    distanceM: distanceM != null && distanceM > 0 ? Math.round(distanceM) : undefined,
    avgHeartRate: hr != null && hr > 0 ? Math.round(hr) : undefined,
    externalId: raw.id != null ? `oura-${raw.id}` : undefined,
    intensity: raw.intensity ? String(raw.intensity) : undefined,
  };
}
