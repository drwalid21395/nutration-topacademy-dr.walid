/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/strava-mapping.ts

وظيفة الملف:
"قاموس الترجمة" الخاص بـ Strava — يحوّل نشاط Strava الخام
(تصنيف الرياضة + الوقت + المسافة + تفاصيل السباحة الاختيارية)
إلى الصيغة الموحّدة للموقع.

لماذا نحتاجه؟
Strava تجمع تدريبات من معظم الساعات (سباحة/جري/دراجة) وترسل
بياناتها بصيغة خاصة. نحن نترجمها هنا مرة واحدة. ملاحظة مهمة:
المسافات في Strava تأتي دائمًا بالأمتار (لا حاجة للتحويل).

لماذا "نقي" (بدون تبعيات)؟
دوال خالصة: كائن يدخل وكائن يخرج — سهلة الاختبار
(ملف .test.ts مرافق).

متى يعمل؟
عند مزامنة Strava (في strava.ts) لكل نشاط.

من يستدعيه؟
- src/lib/wearables/strava.ts (جالب Strava).
- src/lib/wearables/strava-mapping.test.ts (الاختبارات).

الملفات التي يتعامل معها:
- لا يستورد من أي ملف — دوال خالصة.

ترتيب العمل:
نشاط Strava ← classifyStravaSport + mapStravaActivity ←
صيغة موحّدة تفهمها normalize.ts
=================================================
*/

// ========================================
// 1. تصنيف الرياضة وتحويل النشاط
// ========================================

/**
 * تحويلات Strava النقية (بدون أي تبعيات) — قابلة للاختبار وحدة.
 * المسافات في Strava API تأتي دائمًا بالأمتار.
 */

/*
-----------------------------------------
الدالة: classifyStravaSport
-----------------------------------------
وظيفتها: تصنيف نشاط Strava إلى صيغتنا الموحّدة.
Input: type (نوع النشاط) + name (اسمه).
Processing: نفحص النوع ثم الاسم (كلاهما بأحرف صغيرة) بحثًا عن
            كلمات مفتاحية (swim/run/ride/weighttraining...).
Output: swim / run / cycle / walk / gym / other.
يستدعيها: mapStravaActivity.
-----------------------------------------
*/
export function classifyStravaSport(type: string, name: string): string {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t === 'swim' || n.includes('swim')) return 'swim';
  if (t === 'run' || t === 'trailrun' || t === 'virtualrun' || n.includes('run')) return 'run';
  if (t.includes('ride') || n.includes('bike') || n.includes('cycling') || n.includes('velo')) return 'cycle';
  if (t === 'walk' || t === 'hike' || n.includes('walk') || n.includes('hike')) return 'walk';
  if (
    t === 'workout' ||
    t === 'weighttraining' ||
    t === 'elliptical' ||
    t === 'cardio' ||
    t === 'yoga' ||
    t === 'strengthtraining' ||
    t === 'crossfit' ||
    t === 'functional' ||
    n.includes('gym') ||
    n.includes('weights')
  ) {
    return 'gym';
  }
  return 'other';
}

// StravaActivityDetail: تفاصيل السباحة الاختيارية التي نجلبها من
// استجابة النشاط الواحد (لفات / متوسط SWOLF / طول المسبح).
export interface StravaActivityDetail {
  laps?: number;
  average_swolf?: number;
  pool_length?: number;
}

/*
-----------------------------------------
الدالة: mapStravaActivity
-----------------------------------------
وظيفتها: تحويل نشاط Strava إلى صيغة التدريب الموحّدة.
Input: a (النشاط الخام) + detail (تفاصيل السباحة الاختيارية).
Processing: نصنّف الرياضة، نأخذ وقت البدء المحلي، نحسب المدة
            من moving_time (أو elapsed_time إن لم يتوفر) بالثواني
            ثم نحولها لدقائق، ونقرأ المسافة (متر بالفعل) والسعرات
            والنبض وتفاصيل السباحة.
Output: كائن بالصيغة الموحّدة.
يستدعيها: strava.ts (في getWorkouts و sync).
ماذا تستدعي: classifyStravaSport.
-----------------------------------------
*/
export function mapStravaActivity(
  a: Record<string, unknown>,
  detail?: StravaActivityDetail | null
): Record<string, unknown> {
  const type = String(a.type ?? '');
  const sportType = classifyStravaSport(type, String(a.name ?? ''));
  const start = (a.start_date_local as string) ?? (a.start_date as string);
  const distanceM = Number(a.distance ?? 0); // متر دائمًا في Strava
  const movingSec = Number(a.moving_time ?? 0);
  const elapsedSec = Number(a.elapsed_time ?? 0);
  const durationSec = movingSec > 0 ? movingSec : elapsedSec;

  return {
    sportType,
    startTime: new Date(start).toISOString(),
    durationMin: Math.max(1, Math.round(durationSec / 60)),
    caloriesBurned: a.calories != null ? Number(a.calories) : undefined,
    distanceM: distanceM > 0 ? Math.round(distanceM) : undefined,
    externalId: String(a.id ?? ''),
    avgHeartRate: a.average_heartrate != null ? Math.round(Number(a.average_heartrate)) : undefined,
    laps: detail?.laps != null ? Number(detail.laps) : undefined,
    swolf: detail?.average_swolf != null ? Number(detail.average_swolf) : undefined,
    poolLengthM: detail?.pool_length != null ? Number(detail.pool_length) : undefined,
  };
}
