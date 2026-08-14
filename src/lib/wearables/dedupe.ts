/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/dedupe.ts

وظيفة الملف:
محرك "منع التكرار" — نفس جلسة التدريب قد تصل من أكثر من
مصدر (الساعة، Health Connect، Strava...). نحن نتعرف على
الجلسة المكررة ونحتفظ بالأعلى جودة فقط.

لماذا نحتاجه؟
لو دخلت نفس السباحة مرتين (من Fitbit ومن Strava) لظهرت
للسباح كتمرينين بدل تمرين واحد، ولاختلّت حسابات السعرات.

متى يعمل؟
عند إدخال قائمة تدريبات (ingestWorkouts في sync.ts).

من يستدعيه؟
- src/lib/wearables/sync.ts (قبل حفظ التدريبات).

الملفات التي يتعامل معها:
- ./types: صيغة UnifiedWorkout الموحّدة.

ترتيب العمل:
fingerprint لكل تمرين (بصمة) ← مقارنة مع الموجود ← الاحتفاظ
بالأعلى أولوية ← إرجاع { workouts, duplicated }
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// من ملف محلي ./types: صيغة التدريب الموحّدة UnifiedWorkout.
import { UnifiedWorkout } from './types';

/**
 * محرك منع التكرار (Deduplication Engine).
 * نفس جلسة التدريب قد تصل من أكثر من مصدر (الساعة، Health Connect، Strava…)
 * فنقارن: البصمة الزمنية + المدة + النوع + السعرات + المسافة،
 * ونعتمد المصدر الأعلى أولوية ولا نضيف التمرين مرتين.
 */

// ========================================
// 2. البصمة والمقارنة
// ========================================

// Fingerprint: "بصمة التمرين" — معلومات مختصرة تُستخدم لمعرفة
// إن كان التمرين نفسه قد وصل من مصدر آخر.
export interface Fingerprint {
  key: string;
  startTime: Date;
  durationMin: number;
  sportType: string;
  caloriesBurned: number;
  distanceM: number;
}

/*
-----------------------------------------
الدالة: fingerprint (مصدَّرة)
-----------------------------------------
وظيفتها: بناء "بصمة" فريدة للتمرين من بياناته الأساسية.
Input: w (تمرين بالصيغة الموحّدة).
Processing: نجمع الوقت + النوع + المدة + السعرات + المسافة في
            سلسلة واحدة. لاحظ "نوافذ التسامح": نقرّب المدة لأقرب
            5 دقائق والسعرات لأقرب 25 والمسافة لأقرب 50 مترًا —
            حتى المصادر التي تسجّل أرقامًا مختلفة قليلًا عن بعضها
            تُعتبر نفس الجلسة.
Output: كائن Fingerprint.
يستدعيها: dedupeWorkouts (في نفس الملف).
-----------------------------------------
*/
export function fingerprint(w: UnifiedWorkout): Fingerprint {
  return {
    key: [
      w.startTime.toISOString(),
      w.sportType,
      Math.round((w.durationMin ?? 0) / 5), // نافذة 5 دقائق للتسامح
      Math.round((w.caloriesBurned ?? 0) / 25),
      Math.round((w.distanceM ?? 0) / 50),
    ].join('|'),
    startTime: w.startTime,
    durationMin: w.durationMin ?? 0,
    sportType: w.sportType,
    caloriesBurned: w.caloriesBurned ?? 0,
    distanceM: w.distanceM ?? 0,
  };
}

/*
-----------------------------------------
الثابت: SOURCE_PRIORITY + الدالة sourceRank
-----------------------------------------
- SOURCE_PRIORITY: ترتيب أولوية المصادر — الأفضل (أدق قياس)
  أولاً. الإدخال اليدوي في المقدمة ثم Strava ثم Garmin...
- sourceRank: تحوّل اسم المصدر إلى "رقم أولوية" أصغر = أفضل.
  المصدر غير المعروف يعود 90، والغائب 99 (الأسوأ).
يستدعيها: dedupeWorkouts.
-----------------------------------------
*/
/** ترتيب أولوية المصادر — الأفضل (أدق قياس) أولًا. */
const SOURCE_PRIORITY = ['manual', 'strava', 'garmin', 'polar', 'whoop', 'oura', 'fitbit', 'samsungHealth', 'healthConnect', 'xiaomi', 'amazfit', 'huawei', 'appleHealth'];

function sourceRank(provider?: string): number {
  if (!provider) return 99;
  const idx = SOURCE_PRIORITY.indexOf(provider);
  return idx === -1 ? 90 : idx;
}

/**
 * فلترة قائمة التدريبات وإزالة التكرار.
 * `existing` هي التدريبات المحفوظة مسبقًا (بنفس اليوم).
 */
/*
-----------------------------------------
الدالة: dedupeWorkouts (مصدَّرة)
-----------------------------------------
وظيفتها: فلترة قائمة التدريبات وإزالة التكرار.
Input: incoming (القادمون الجدد) + existing (المحفوظون مسبقًا
       في نفس اليوم/النافذة).
Processing: نبني خريطتين: keep (البصمات) و seen (التمرين الفائز).
            أولاً نُسجّل البصمات الموجودة، ثم لكل قادم:
            - إن كانت بصمته موجودة → نقارن أولوية المصدر ونبقي
              الأعلى أولوية فقط.
            - وإلا → نضيفه كجديد.
Output: { workouts: القائمة النهائية بدون تكرار، duplicated: عدد
        التكرارات المستبعدة }.
يستدعيها: sync.ts (في ingestWorkouts).
ماذا تستدعي: fingerprint و sourceRank (في نفس الملف).
-----------------------------------------
*/
export function dedupeWorkouts(
  incoming: UnifiedWorkout[],
  existing: Array<{ startTime: Date; durationMin: number | null; sportType: string; caloriesBurned: number | null; distanceM: number | null; provider: string | null }>
): { workouts: UnifiedWorkout[]; duplicated: number } {
  const seen = new Map<string, UnifiedWorkout>();
  const keep = new Map<string, Fingerprint>();

  for (const e of existing) {
    const fp = fingerprint({
      startTime: e.startTime,
      durationMin: e.durationMin ?? 0,
      sportType: e.sportType,
      caloriesBurned: e.caloriesBurned ?? 0,
      distanceM: e.distanceM ?? 0,
      provider: e.provider ?? undefined,
    });
    keep.set(fp.key, fp);
  }

  for (const w of incoming) {
    const fp = fingerprint(w);
    const prev = keep.get(fp.key);
    if (prev) {
      // نفس الجلسة موجودة — نبقي الأعلى أولوية فقط.
      const prevSource = prev as unknown as { provider?: string };
      if (sourceRank(w.provider) < sourceRank(prevSource.provider)) {
        keep.set(fp.key, fp);
        seen.set(fp.key, w);
      }
      continue;
    }
    keep.set(fp.key, fp);
    seen.set(fp.key, w);
  }

  const duplicateCount = incoming.length - seen.size;
  return { workouts: [...seen.values()], duplicated: Math.max(0, duplicateCount) };
}
