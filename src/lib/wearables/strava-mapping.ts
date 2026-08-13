/**
 * تحويلات Strava النقية (بدون أي تبعيات) — قابلة للاختبار وحدة.
 * المسافات في Strava API تأتي دائمًا بالأمتار.
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

export interface StravaActivityDetail {
  laps?: number;
  average_swolf?: number;
  pool_length?: number;
}

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
