import { UnifiedWorkout } from './types';

/**
 * محرك منع التكرار (Deduplication Engine).
 * نفس جلسة التدريب قد تصل من أكثر من مصدر (الساعة، Health Connect، Strava…)
 * فنقارن: البصمة الزمنية + المدة + النوع + السعرات + المسافة،
 * ونعتمد المصدر الأعلى أولوية ولا نضيف التمرين مرتين.
 */

export interface Fingerprint {
  key: string;
  startTime: Date;
  durationMin: number;
  sportType: string;
  caloriesBurned: number;
  distanceM: number;
}

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
