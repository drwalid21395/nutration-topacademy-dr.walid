/**
 * تحويلات Polar النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 */

export function mapPolarSport(sport: string): string {
  const s = (sport ?? '').toUpperCase();
  if (s.includes('SWIM')) return 'swim';
  if (s.includes('RUN')) return 'run';
  if (s.includes('CYCL') || s.includes('BIKE') || s.includes('SPIN')) return 'cycle';
  if (s.includes('WALK') || s.includes('HIKE')) return 'walk';
  if (
    s.includes('WEIGHT') ||
    s.includes('GYM') ||
    s.includes('FITNESS') ||
    s.includes('CIRCUIT') ||
    s.includes('TRAINER') ||
    s.includes('CROSSFIT') ||
    s.includes('CORE')
  ) {
    return 'gym';
  }
  return 'other';
}

/** مدة Polar بصيغة "HH:MM:SS" → دقائق. */
export function parsePolarDuration(duration: string | number | undefined): number | undefined {
  if (duration == null) return undefined;
  if (typeof duration === 'number') return Math.round(duration / 60000);
  const parts = String(duration).split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }
  const n = Number(duration);
  return Number.isNaN(n) ? undefined : Math.round(n / 60000);
}
