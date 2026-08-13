import { prisma } from '@/lib/prisma';
import { decryptText, encryptText } from '@/lib/crypto';
import { WearableProviderAdapter, ProviderHealthData, WearableProviderId, ProviderNotConfiguredError } from './types';
import {
  mapFitbitActivitySummary,
  mapFitbitSleep,
  mapFitbitHeart,
  mapFitbitWorkout,
} from './fitbit-mapping';

/**
 * جالب Fitbit الفعلي (Fitbit Web API v1).
 * - OAuth 3-legged من المتصفح — مجاني وسجل ذاتي (dev.fitbit.com).
 * - جلب النشاط اليومي + النوم + النبض + الوزن + قائمة التدريبات لآخر ٧ أيام.
 * - تجديد التوكن تلقائيًا (توكن الوصول ينتهي كل ٨ ساعات).
 */

const FITBIT_API = 'https://api.fitbit.com/1/user/-';
const FITBIT_AUTH = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN = 'https://api.fitbit.com/oauth2/token';
const DAYS_BACK = 7;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fitbitGet(path: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${FITBIT_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('توكن Fitbit غير صالح — أعد الربط.');
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, unknown>>;
}

export class FitbitAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'fitbit';

  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    const clientId = process.env.FITBIT_CLIENT_ID;
    if (!clientId) return { status: 'unsupported' };
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=fitbit`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'activity heartrate sleep weight profile',
      expires_in: '31536000',
    });
    return { status: 'redirect', url: `${FITBIT_AUTH}?${params.toString()}` };
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
    if (!access) throw new Error('لا يوجد توكن Fitbit — أعد الربط.');
    const expired = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expired) return access;

    const clientId = process.env.FITBIT_CLIENT_ID ?? '';
    const clientSecret = process.env.FITBIT_CLIENT_SECRET ?? '';
    const refresh = decryptText(conn.refreshToken);
    if (!clientId || !refresh) throw new Error('تعذر تجديد توكن Fitbit — أعد الربط.');

    const res = await fetch(FITBIT_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    });
    if (!res.ok) throw new Error('فشل تجديد توكن Fitbit — أعد ربط الجهاز.');
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('فشل تجديد توكن Fitbit — أعد ربط الجهاز.');

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

  /** قائمة التدريبات المسجلة لآخر ٣٠ يومًا. */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const after = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const res = await fitbitGet(`/activities/list.json?afterDate=${dateStr(after)}&sort=asc&offset=0&limit=100`, token);
    const list = (res.activities as Array<Record<string, unknown>>) ?? [];
    return list.map((a) => mapFitbitWorkout(a));
  }

  /** مزامنة شاملة لآخر ٧ أيام: نشاط + نوم + نبض + وزن + تدريبات. */
  async sync(userId: string, _token: string | null): Promise<ProviderHealthData> {
    const conn = await prisma.wearableConnection.findFirst({
      where: { userId, provider: 'fitbit', status: 'connected' },
      select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
    });
    if (!conn || !conn.accessToken) throw new ProviderNotConfiguredError('fitbit');
    const token = await this.refreshIfNeeded(conn);

    const today = new Date();
    const activity: Array<Record<string, unknown>> = [];
    const weight: Array<{ date: Date; weightKg: number }> = [];

    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const ds = dateStr(day);
      const row: Record<string, unknown> = { date: day.toISOString() };

      try {
        const act = await fitbitGet(`/activities/date/${ds}.json`, token);
        const mapped = mapFitbitActivitySummary(act);
        Object.assign(row, mapped);
      } catch {
        // يوم بلا نشاط.
      }

      try {
        const sleep = await fitbitGet(`/sleep/date/${ds}.json`, token);
        Object.assign(row, mapFitbitSleep(sleep));
      } catch {
        // لا نوم.
      }

      try {
        const heart = await fitbitGet(`/activities/heart/date/${ds}/1d.json`, token);
        Object.assign(row, mapFitbitHeart(heart));
      } catch {
        // لا نبض.
      }

      try {
        const w = await fitbitGet(`/body/log/weight/date/${ds}.json`, token);
        const list = (w.weight as Array<{ weight?: number }> | undefined) ?? [];
        const last = list[0];
        if (last?.weight) {
          weight.push({ date: new Date(`${ds}T00:00:00`), weightKg: Math.round(last.weight * 100) / 100 });
        }
      } catch {
        // لا وزن.
      }

      if (row.steps != null || row.sleepMinutes != null || row.restingHeartRate != null || row.activeCalories != null) {
        activity.push(row);
      }
    }

    const workouts = await this.getWorkouts(token);
    return { activity: activity as unknown as ProviderHealthData['activity'], workouts, weight };
  }
}
