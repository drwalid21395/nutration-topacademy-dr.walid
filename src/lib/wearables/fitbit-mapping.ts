/**
 * تحويلات Fitbit النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 * Fitbit API v1: https://dev.fitbit.com/build/reference/web-api/
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

/** مدة Fitbit (مللي ثانية) → دقائق. */
export function parseFitbitDuration(ms: number | null | undefined): number | undefined {
  if (ms == null) return undefined;
  const n = Number(ms);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n / 60000);
}

/** مسافة Fitbit (كم) → متر. */
export function fitbitDistanceToMeters(km: number | null | undefined): number | undefined {
  if (km == null) return undefined;
  const n = Number(km);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n * 1000);
}

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

/** استخراج معدل نبض الراحة من استجابة النبض اليومية. */
export function mapFitbitHeart(raw: Record<string, unknown>): { restingHeartRate?: number } {
  const list = (raw['activities-heart'] as Array<{ value?: { restingHeartRate?: number } }> | undefined) ?? [];
  const rhr = list[0]?.value?.restingHeartRate;
  if (rhr != null && rhr > 0) return { restingHeartRate: Math.round(rhr) };
  return {};
}

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
