/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/oura.ts

وظيفة الملف:
"المحوّل الفعلي" (Adapter) لخاتم/ساعة Oura — يستقبل البيانات
من Oura Cloud API v2 ويحوّلها للصيغة الموحّدة عبر
oura-mapping.ts، مع تجديد التوكن تلقائيًا.

لماذا نحتاجه؟
Oura توفر بيانات نوم ونشاط ممتازة (النوم هو تخصصها). بدل
كتابة منطقها في كل مكان، نضعه كله هنا: رابط الربط، جلب
النشاط والنوم والجاهزية (readiness) والتدريبات، وتجديد التوكن.
هو "مترجم من لغة Oura إلى لغة الموقع".

متى يعمل؟
- عند بدء الربط من المتصفح (connect).
- عند المزامنة الدورية أو اليدوية (sync / getWorkouts).

من يستدعيه؟
- src/lib/wearables/adapters.ts (يرجعه كمحوّل عند طلب oura).
- src/lib/wearables/sync.ts (للمزامنة).

الملفات التي يتعامل معها:
- ./types: الواجهة الموحّدة WearableProviderAdapter.
- ./oura-mapping: تحويل الاستجابات الخام إلى الصيغة الموحّدة.
- src/lib/crypto.ts: تشفير/فك تشفير التوكنات.
- src/lib/prisma.ts: قراءة/تحديث اتصال المستخدم.

ترتيب العمل:
connect (رابط الإذن) ← callback يخزن التوكن ← sync: تجديد
التوكن لو انتهى ← جلب النشاط + النوم + الجاهزية لـ 7 أيام ←
دمجها حسب اليوم + التدريبات ← تمرير النتيجة للـ ingest
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// prisma: من ملف محلي (src/lib/prisma.ts) — الاتصال بقاعدة البيانات.
import { prisma } from '@/lib/prisma';

// من ملف محلي src/lib/crypto.ts: تشفير التوكن قبل الحفظ وفكّه قبل الاستخدام.
import { decryptText, encryptText } from '@/lib/crypto';

// من ملف محلي ./types: الواجهة الموحّدة + أشكال البيانات + الخطأ الموحّد.
import { WearableProviderAdapter, ProviderHealthData, WearableProviderId, ProviderNotConfiguredError } from './types';

// من ملف محلي ./oura-mapping: "قاموس الترجمة" — يحوّل استجابات
// Oura الخام إلى الصيغة الموحّدة.
import { mapOuraDailyActivity, mapOuraDailySleep, mapOuraWorkout } from './oura-mapping';

/**
 * جالب Oura الفعلي (Oura Cloud API v2).
 * - OAuth 3-legged من المتصفح — مجاني وسجل ذاتي (cloud.ouraring.com/oauth).
 * - جلب النشاط اليومي + النوم + النبض + التدريبات لآخر ٧ أيام.
 * - تجديد التوكن تلقائيًا.
 */

// ========================================
// 2. ثوابت الاتصال بموقع Oura
// ========================================

// عناوين Oura الرسمية (API + صفحة الإذن + نقطة تبديل التوكن).
const OURA_API = 'https://api.ouraring.com/v2';
const OURA_AUTH = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN = 'https://api.ouraring.com/oauth/token';

// كم يومًا نرجع إلى الوراء عند المزامنة (آخر أسبوع).
const DAYS_BACK = 7;

// dateStr: تحويل تاريخ إلى نص YYYY-MM-DD (الصيغة التي تقبلها Oura).
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ouraGet: دالة مساعدة داخلية ترسل طلب GET إلى Oura بحامل التوكن.
// استجابات Oura تأتي بصيغة { data: [...] }. الأخطاء غير 401
// نتعامل معها كقائمة فارغة (يوم بلا بيانات).
async function ouraGet(path: string, token: string): Promise<{ data?: Array<Record<string, unknown>> }> {
  const res = await fetch(`${OURA_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('توكن Oura غير صالح — أعد الربط.');
  if (!res.ok) return { data: [] };
  return res.json() as Promise<{ data?: Array<Record<string, unknown>> }>;
}

// ========================================
// 3. المحوّل OuraAdapter
// ========================================

/*
-----------------------------------------
الصنف: OuraAdapter
-----------------------------------------
وظيفته: تنفيذ واجهة WearableProviderAdapter لصالح Oura —
        الربط، المزامنة، جلب التدريبات، وتجديد التوكن.
id: يصرّح بنفسه كمزود 'oura'.
-----------------------------------------
*/
export class OuraAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'oura';

  // connect: يبني رابط الإذن الرسمي (OAuth) مع الصلاحيات المطلوبة
  // (نشاط يومي، نبض، شخصي، جلسات، نوم، وسوم، تدريب).
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

  // disconnect: Oura لا يملك مسارًا موحّدًا للإلغاء —
  // يُترك الإلغاء يدويًا لدى Oura.
  async disconnect(_userId: string): Promise<void> {
    return undefined;
  }

  /*
  -----------------------------------------
  الدالة الداخلية: refreshIfNeeded
  -----------------------------------------
  وظيفتها: التأكد أن التوكن ساري، وتجديده تلقائيًا عند قرب انتهائه.
  Input: conn (الاتصال المحفوظ مع توكناته المشفرة).
  Processing: إن بقي أقل من 5 دقائق نطلب توكنًا جديدًا من Oura
              (باستخدام التوكن المنعّش) ثم نحفظ الجديد مشفّرًا.
  Output: توكن وصول ساري.
  يستدعيها: sync (في نفس الصنف).
  ماذا تستدعي: decryptText/encryptText + prisma + fetch.
  -----------------------------------------
  */
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

  /*
  -----------------------------------------
  الدالة: getWorkouts
  -----------------------------------------
  وظيفتها: جلب التدريبات المسجلة لآخر 30 يومًا من Oura.
  Input: token (توكن وصول ساري).
  Processing: نطلب قائمة التدريبات من Oura ثم نترجم كل عنصر
              عبر mapOuraWorkout.
  Output: قائمة بالصيغة الموحّدة.
  يستدعيها: sync (في نفس الصنف).
  ماذا تستدعي: ouraGet + mapOuraWorkout.
  -----------------------------------------
  */
  /** التدريبات المسجلة لآخر ٣٠ يومًا. */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = new Date();
    const res = await ouraGet(`/usercollection/workout?start_date=${dateStr(start)}&end_date=${dateStr(end)}`, token);
    return (res.data ?? []).map((w) => mapOuraWorkout(w));
  }

  /*
  -----------------------------------------
  الدالة: sync
  -----------------------------------------
  وظيفتها: مزامنة شاملة لآخر 7 أيام من Oura.
  Input: userId + التوكن (نهمله لأننا نقرأ من القاعدة).
  Processing: نجلب الاتصال المحفوظ ونضمن توكنًا ساريًا، ثم نجلب
              بالتوازي النشاط اليومي + النوم + الجاهزية (readiness).
              نبني خريطتين (نوم ونبض راحة لكل يوم) ثم ندمج كل شيء
              في صف نشاط واحد لكل يوم، ثم نجلب التدريبات.
  Output: ProviderHealthData (نشاط + تدريبات).
  يستدعيها: sync.ts عبر runSyncConnection.
  ماذا تستدعي: refreshIfNeeded + getWorkouts + دوال map* + ouraGet.
  -----------------------------------------
  */
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
