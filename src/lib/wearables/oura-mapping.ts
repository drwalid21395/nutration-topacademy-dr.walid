/**
 * تحويلات Oura النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 * Oura Cloud API v2: https://cloud.ouraring.com/docs
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

/** ثوانٍ → دقائق. */
export function ouraSecondsToMinutes(seconds: number | null | undefined): number | undefined {
  if (seconds == null) return undefined;
  const n = Number(seconds);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n / 60);
}

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
