import { prisma } from '@/lib/prisma';
import { decryptText, encryptText } from '@/lib/crypto';
import { WearableProviderAdapter, ProviderHealthData, WearableProviderId, ProviderNotConfiguredError } from './types';
import { mapOuraDailyActivity, mapOuraDailySleep, mapOuraWorkout } from './oura-mapping';

/**
 * جالب Oura الفعلي (Oura Cloud API v2).
 * - OAuth 3-legged من المتصفح — مجاني وسجل ذاتي (cloud.ouraring.com/oauth).
 * - جلب النشاط اليومي + النوم + النبض + التدريبات لآخر ٧ أيام.
 * - تجديد التوكن تلقائيًا.
 */

const OURA_API = 'https://api.ouraring.com/v2';
const OURA_AUTH = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN = 'https://api.ouraring.com/oauth/token';
const DAYS_BACK = 7;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ouraGet(path: string, token: string): Promise<{ data?: Array<Record<string, unknown>> }> {
  const res = await fetch(`${OURA_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('توكن Oura غير صالح — أعد الربط.');
  if (!res.ok) return { data: [] };
  return res.json() as Promise<{ data?: Array<Record<string, unknown>> }>;
}

export class OuraAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'oura';

  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    const clientId = process.env.OURA_CLIENT_ID;
    if (!clientId) return { status: 'unsupported' };
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=oura`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'daily heartrate personal session sleep tag workout',
    });
    return { status: 'redirect', url: `${OURA_AUTH}?${params.toString()}` };
  }

  async disconnect(_userId: string): Promise<void> {
    return undefined;
  }

  private async refreshIfNeeded(conn: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    const access = decryptText(conn.accessToken);
    if (!access) throw new Error('لا يوجد توكن Oura — أعد الربط.');
    const expired = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expired) return access;

    const clientId = process.env.OURA_CLIENT_ID ?? '';
    const clientSecret = process.env.OURA_CLIENT_SECRET ?? '';
    const refresh = decryptText(conn.refreshToken);
    if (!clientId || !refresh) throw new Error('تعذر تجديد توكن Oura — أعد الربط.');

    const res = await fetch(OURA_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error('فشل تجديد توكن Oura — أعد ربط الجهاز.');
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('فشل تجديد توكن Oura — أعد ربط الجهاز.');

    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: encryptText(data.access_token),
        refreshToken: data.refresh_token ? encryptText(data.refresh_token) : conn.refreshToken,
        tokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        lastSyncError: null,
      },
    });
    return data.access_token;
  }

  /** التدريبات المسجلة لآخر ٣٠ يومًا. */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = new Date();
    const res = await ouraGet(`/usercollection/workout?start_date=${dateStr(start)}&end_date=${dateStr(end)}`, token);
    return (res.data ?? []).map((w) => mapOuraWorkout(w));
  }

  /** مزامنة شاملة لآخر ٧ أيام: نشاط + نوم + نبض + تدريبات. */
  async sync(userId: string, _token: string | null): Promise<ProviderHealthData> {
    const conn = await prisma.wearableConnection.findFirst({
      where: { userId, provider: 'oura', status: 'connected' },
      select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
    });
    if (!conn || !conn.accessToken) throw new ProviderNotConfiguredError('oura');
    const token = await this.refreshIfNeeded(conn);

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS_BACK - 1));
    const sd = dateStr(start);
    const ed = dateStr(today);

    const [activityRes, sleepRes, readinessRes] = await Promise.all([
      ouraGet(`/usercollection/daily_activity?start_date=${sd}&end_date=${ed}`, token),
      ouraGet(`/usercollection/daily_sleep?start_date=${sd}&end_date=${ed}`, token),
      ouraGet(`/usercollection/daily_readiness?start_date=${sd}&end_date=${ed}`, token),
    ]);

    const sleepByDay = new Map<string, Record<string, unknown>>();
    for (const s of sleepRes.data ?? []) {
      const day = dateStr(new Date(String(s.day ?? s.day_start ?? sd)));
      sleepByDay.set(day, s);
    }
    const rhrByDay = new Map<string, number>();
    for (const r of readinessRes.data ?? []) {
      const day = dateStr(new Date(String(r.day ?? sd)));
      if (r.resting_heart_rate != null) rhrByDay.set(day, Math.round(Number(r.resting_heart_rate)));
    }

    const activity: Array<Record<string, unknown>> = [];
    for (const a of activityRes.data ?? []) {
      const day = dateStr(new Date(String(a.day ?? a.day_start ?? sd)));
      const row: Record<string, unknown> = { ...mapOuraDailyActivity(a), date: new Date(`${day}T00:00:00`).toISOString() };
      const sleep = sleepByDay.get(day);
      if (sleep) Object.assign(row, mapOuraDailySleep(sleep));
      if (rhrByDay.has(day)) row.restingHeartRate = rhrByDay.get(day);
      if (row.steps != null || row.sleepMinutes != null || row.avgHeartRate != null || row.activeCalories != null) {
        activity.push(row);
      }
    }

    const workouts = await this.getWorkouts(token);
    return { activity: activity as unknown as ProviderHealthData['activity'], workouts };
  }
}
