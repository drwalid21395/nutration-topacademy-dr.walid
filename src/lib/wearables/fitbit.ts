/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/fitbit.ts

وظيفة الملف:
"المحوّل الفعلي" (Adapter) لساعات Fitbit — يستقبل البيانات
من Fitbit Web API v1 ويحوّلها للصيغة الموحّدة عبر
fitbit-mapping.ts. يُراعي أيضًا تجديد التوكن تلقائيًا لأن
توكن الوصول ينتهي كل 8 ساعات.

لماذا نحتاجه؟
بدل أن نكتب منطق Fitbit في كل مكان، نضع كل شيء هنا:
رابط الربط، جلب النشاط والنوم والنبض والوزن والتدريبات،
وتجديد التوكن. هو "مترجم من لغة Fitbit إلى لغة الموقع".

متى يعمل؟
- عند بدء الربط من المتصفح (connect).
- عند المزامنة الدورية أو اليدوية (sync / getWorkouts).

من يستدعيه؟
- src/lib/wearables/adapters.ts (يرجعه كمحوّل عند طلب fitbit).
- src/lib/wearables/sync.ts (للمزامنة).

الملفات التي يتعامل معها:
- ./types: الواجهة الموحّدة WearableProviderAdapter.
- ./fitbit-mapping: تحويل الاستجابات الخام إلى الصيغة الموحّدة.
- src/lib/crypto.ts: تشفير/فك تشفير التوكنات.
- src/lib/prisma.ts: قراءة/تحديث اتصال المستخدم.

ترتيب العمل:
connect (رابط الإذن) ← callback يخزن التوكن ← sync: تجديد
التوكن لو انتهى ← جلب 7 أيام (نشاط+نوم+نبض+وزن) + تدريبات ←
تمرير النتيجة لـ ingestProviderData
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

// من ملف محلي ./fitbit-mapping: "قاموس الترجمة" — يحوّل استجابات
// Fitbit الخام إلى الصيغة الموحّدة.
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

// ========================================
// 2. ثوابت الاتصال بموقع Fitbit
// ========================================

// عناوين Fitbit الرسمية (API + صفحة الإذن + نقطة تبديل التوكن).
const FITBIT_API = 'https://api.fitbit.com/1/user/-';
const FITBIT_AUTH = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN = 'https://api.fitbit.com/oauth2/token';

// كم يومًا نرجع إلى الوراء عند المزامنة (آخر أسبوع).
const DAYS_BACK = 7;

// dateStr: تحويل تاريخ إلى نص YYYY-MM-DD (الصيغة التي تقبلها Fitbit).
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// fitbitGet: دالة مساعدة داخلية ترسل طلب GET إلى Fitbit بحامل
// التوكن (Bearer). الخطأ 401 يعني توكن غير صالح، وبقية الأخطاء
// نتعامل معها كيوم بلا بيانات ({}).
async function fitbitGet(path: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${FITBIT_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('توكن Fitbit غير صالح — أعد الربط.');
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, unknown>>;
}

// ========================================
// 3. المحوّل FitbitAdapter
// ========================================

/*
-----------------------------------------
الصنف: FitbitAdapter
-----------------------------------------
وظيفته: تنفيذ واجهة WearableProviderAdapter لصالح Fitbit —
        الربط، المزامنة، جلب التدريبات، وتجديد التوكن.
id: يصرّح بنفسه كمزود 'fitbit'.
-----------------------------------------
*/
export class FitbitAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'fitbit';

  // connect: يبني رابط الإذن الرسمي (OAuth) مع الصلاحيات المطلوبة
  // (نشاط، نبض، نوم، وزن، ملف) ويُعيد رابط التوجيه إن وُجد Client ID.
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

  // disconnect: Fitbit لا يملك مسارًا موحّدًا للإلغاء —
  // يُترك الإلغاء يدويًا لدى Fitbit.
  async disconnect(_userId: string): Promise<void> {
    return undefined;
  }

  /*
  -----------------------------------------
  الدالة الداخلية: refreshIfNeeded
  -----------------------------------------
  وظيفتها: التأكد أن التوكن ساري، وتجديده تلقائيًا عند قرب انتهائه.
  Input: conn (الاتصال المحفوظ مع توكناته المشفرة).
  Processing: ننظر إلى تاريخ الانتهاء؛ إن بقي أقل من 5 دقائق نطلب
              توكنًا جديدًا من Fitbit (باستخدام التوكن المنعّش) ثم
              نحفظ الجديد مشفّرًا في القاعدة.
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

  /*
  -----------------------------------------
  الدالة: getWorkouts
  -----------------------------------------
  وظيفتها: جلب قائمة التدريبات المسجلة لآخر 30 يومًا.
  Input: token (توكن وصول ساري).
  Processing: نطلب قائمة النشاطات من Fitbit ثم نترجم كل عنصر
              عبر mapFitbitWorkout.
  Output: قائمة بالصيغة الموحّدة.
  يستدعيها: sync (في نفس الصنف) وأي مسار يطلب تدريبات Fitbit.
  ماذا تستدعي: fitbitGet + mapFitbitWorkout.
  -----------------------------------------
  */
  /** قائمة التدريبات المسجلة لآخر ٣٠ يومًا. */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const after = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const res = await fitbitGet(`/activities/list.json?afterDate=${dateStr(after)}&sort=asc&offset=0&limit=100`, token);
    const list = (res.activities as Array<Record<string, unknown>>) ?? [];
    return list.map((a) => mapFitbitWorkout(a));
  }

  /*
  -----------------------------------------
  الدالة: sync
  -----------------------------------------
  وظيفتها: مزامنة شاملة لآخر 7 أيام من Fitbit.
  Input: userId + التوكن (نهمله هنا لأننا نقرأ من القاعدة).
  Processing: نجلب الاتصال المحفوظ ونضمن توكنًا ساريًا، ثم لكل
              يوم من أيام الأسبوع نجلب النشاط والنوم والنبض والوزن
              (كل طلب داخل try منفصل — أي فشل لا يوقف الباقي)،
              ثم نجلب التدريبات.
  Output: ProviderHealthData (نشاط + تدريبات + وزن) جاهز للتخزين.
  يستدعيها: sync.ts عبر runSyncConnection.
  ماذا تستدعي: refreshIfNeeded + getWorkouts + دوال map* + prisma.
  -----------------------------------------
  */
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
