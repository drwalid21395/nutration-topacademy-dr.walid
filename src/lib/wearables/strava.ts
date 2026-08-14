/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/strava.ts

وظيفة الملف:
"المحوّل الفعلي" (Adapter) لمنصة Strava — يجلب التدريبات
(سباحة/جري/دراجة) من Strava API v3 مع تفاصيل السباحة
(لفات/SWOLF/طول المسبح)، ويحوّلها للصيغة الموحّدة عبر
strava-mapping.ts، مع تجديد التوكن تلقائيًا (ينتهي بعد 6 ساعات).

لماذا نحتاجه؟
Strava مجانية وسجل ذاتي وتجمع تدريبات معظم الساعات — بوابة
سهلة لإدخال تدريبات السباح. بدل كتابة منطقها في كل مكان،
نضعه كله هنا. هو "مترجم من لغة Strava إلى لغة الموقع".

متى يعمل؟
- عند بدء الربط من المتصفح (connect).
- عند المزامنة الدورية أو اليدوية (sync / getWorkouts).

من يستدعيه؟
- src/lib/wearables/adapters.ts (يرجعه كمحوّل عند طلب strava).
- src/lib/wearables/sync.ts (للمزامنة).

الملفات التي يتعامل معها:
- ./types: الواجهة الموحّدة WearableProviderAdapter.
- ./strava-mapping: تحويل النشاطات الخام إلى الصيغة الموحّدة.
- src/lib/crypto.ts: تشفير/فك تشفير التوكنات.
- src/lib/prisma.ts: قراءة/تحديث اتصال المستخدم.

ترتيب العمل:
connect (رابط الإذن) ← callback يخزن التوكن ← sync: تجديد
التوكن لو انتهى ← جلب التدريبات (مع تفاصيل السباحة لكل نشاط) ←
تمرير النتيجة للـ ingest
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

// من ملف محلي ./strava-mapping: "قاموس الترجمة" — تحويل نشاطات
// Strava الخام إلى الصيغة الموحّدة + نوع تفاصيل السباحة.
import { mapStravaActivity, StravaActivityDetail } from './strava-mapping';

/**
 * جالب Strava الفعلي (Strava API v3).
 * - OAuth 3-legged من المتصفح (مجاني وسجل ذاتي).
 * - جلب تدريبات السباحة/الجري/الدراجة لآخر ٧ أيام مع تفاصيل السباحة (لفات/SWOLF/طول المسبح).
 * - تجديد التوكن تلقائيًا (توكن الوصول ينتهي بعد ٦ ساعات).
 */

// ========================================
// 2. ثوابت الاتصال بموقع Strava
// ========================================

// عناوين Strava الرسمية (قاعدة API + صفحة الإذن/التوكن).
const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_AUTH = 'https://www.strava.com/oauth';

// كم يومًا نرجع إلى الوراء عند المزامنة (آخر أسبوع).
const DAYS_BACK = 7;

// stravaGet: دالة مساعدة داخلية ترسل طلب GET إلى Strava بحامل
// التوكن. الخطأ 401 يعني توكن غير صالح، وبقية الأخطاء تُطرح
// كخطأ (بخلاف بقية الجالبين التي تتجاهلها).
async function stravaGet(path: string, token: string): Promise<Record<string, unknown> | Array<Record<string, unknown>>> {
  const res = await fetch(`${STRAVA_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('توكن Strava غير صالح — أعد الربط.');
  if (!res.ok) throw new Error(`خطأ Strava (${res.status}) — ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown> | Array<Record<string, unknown>>>;
}

// ========================================
// 3. المحوّل StravaAdapter
// ========================================

/*
-----------------------------------------
الصنف: StravaAdapter
-----------------------------------------
وظيفته: تنفيذ واجهة WearableProviderAdapter لصالح Strava —
        الربط، المزامنة، جلب التدريبات مع تفاصيل السباحة،
        وتجديد التوكن.
id: يصرّح بنفسه كمزود 'strava'.
-----------------------------------------
*/
export class StravaAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'strava';

  // connect: يبني رابط الإذن الرسمي (OAuth) مع الصلاحيات
  // (قراءة الملف وقراءة كل النشاطات).
  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) return { status: 'unsupported' };
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=strava`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all,profile:read_all',
      approval_prompt: 'auto',
    });
    return { status: 'redirect', url: `${STRAVA_AUTH}/authorize?${params.toString()}` };
  }

  // disconnect: Strava لا يملك مسارًا موحّدًا للإلغاء —
  // يُترك الإلغاء يدويًا لدى Strava.
  async disconnect(_userId: string): Promise<void> {
    return undefined;
  }

  /*
  -----------------------------------------
  الدالة الداخلية: refreshIfNeeded
  -----------------------------------------
  وظيفتها: التأكد أن التوكن ساري، وتجديده تلقائيًا عند قرب انتهائه.
  Input: conn (الاتصال المحفوظ مع توكناته المشفرة).
  Processing: إن بقي أقل من 5 دقائق نطلب توكنًا جديدًا من Strava
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
    if (!access) throw new Error('لا يوجد توكن Strava — أعد الربط.');
    const expired = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expired) return access;

    const clientId = process.env.STRAVA_CLIENT_ID ?? '';
    const clientSecret = process.env.STRAVA_CLIENT_SECRET ?? '';
    const refresh = decryptText(conn.refreshToken);
    if (!clientId || !refresh) throw new Error('تعذر تجديد توكن Strava — أعد الربط.');

    const res = await fetch(`${STRAVA_AUTH}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error('فشل تجديد توكن Strava — أعد ربط الجهاز.');
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_at?: number };
    if (!data.access_token) throw new Error('فشل تجديد توكن Strava — أعد ربط الجهاز.');

    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: encryptText(data.access_token),
        refreshToken: data.refresh_token ? encryptText(data.refresh_token) : conn.refreshToken,
        tokenExpiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
        lastSyncError: null,
      },
    });
    return data.access_token;
  }

  /*
  -----------------------------------------
  الدالة: getWorkouts
  -----------------------------------------
  وظيفتها: جلب آخر 30 يومًا من التدريبات (مع تفاصيل السباحة).
  Input: token (توكن وصول ساري).
  Processing: نطلب قائمة النشاطات (حتى 100)، ولكل نشاط سباحة
              نجلب التفاصيل (لفات/SWOLF/طول المسبح) من مسار
              النشاط الواحد، ثم نترجم كل شيء عبر mapStravaActivity.
  Output: قائمة بالصيغة الموحّدة.
  يستدعيها: sync (في نفس الصنف) وأي مسار يطلب التدريبات.
  ماذا تستدعي: stravaGet + mapStravaActivity.
  -----------------------------------------
  */
  /** جلب آخر ٣٠ يومًا من التدريبات (مع تفاصيل السباحة). */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const after = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
    const res = await stravaGet(`/athlete/activities?per_page=100&after=${after}`, token);
    const list = Array.isArray(res) ? res : [];

    const workouts: Record<string, unknown>[] = [];
    for (const raw of list) {
      const a = raw as Record<string, unknown>;
      let detail: StravaActivityDetail | null = null;
      if (String(a.type ?? '').toLowerCase() === 'swim') {
        try {
          const d = (await stravaGet(`/activities/${a.id}`, token)) as Record<string, unknown>;
          detail = {
            laps: d.laps != null ? Number(d.laps) : undefined,
            average_swolf: d.average_swolf != null ? Number(d.average_swolf) : undefined,
            pool_length: d.pool_length != null ? Number(d.pool_length) : undefined,
          };
        } catch {
          detail = null;
        }
      }
      workouts.push(mapStravaActivity(a, detail));
    }
    return workouts;
  }

  /*
  -----------------------------------------
  الدالة: sync
  -----------------------------------------
  وظيفتها: مزامنة شاملة — تدريبات آخر 7 أيام تُمرَّر لخط التطبيع.
  Input: userId + التوكن (نهمله لأننا نقرأ من القاعدة).
  Processing: نجلب الاتصال المحفوظ ونضمن توكنًا ساريًا، ثم نجلب
              نشاطات آخر 7 أيام (مع تفاصيل السباحة) ونترجمها.
  Output: ProviderHealthData (تدريبات فقط — Strava لا توفر
          نشاطًا يوميًا شاملاً بنفس الدقة).
  يستدعيها: sync.ts عبر runSyncConnection.
  ماذا تستدعي: refreshIfNeeded + stravaGet + mapStravaActivity.
  -----------------------------------------
  */
  /** مزامنة شاملة: تدريبات آخر ٧ أيام → تُمرَّر لخط التطبيع. */
  async sync(userId: string, token: string | null): Promise<ProviderHealthData> {
    const conn = await prisma.wearableConnection.findFirst({
      where: { userId, provider: 'strava', status: 'connected' },
      select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
    });
    if (!conn || !conn.accessToken) throw new ProviderNotConfiguredError('strava');
    const valid = await this.refreshIfNeeded(conn);

    const after = Math.floor((Date.now() - DAYS_BACK * 24 * 3600 * 1000) / 1000);
    const res = await stravaGet(`/athlete/activities?per_page=100&after=${after}`, valid);
    const list = Array.isArray(res) ? res : [];

    const workouts: Record<string, unknown>[] = [];
    for (const raw of list) {
      const a = raw as Record<string, unknown>;
      let detail: StravaActivityDetail | null = null;
      if (String(a.type ?? '').toLowerCase() === 'swim') {
        try {
          const d = (await stravaGet(`/activities/${a.id}`, valid)) as Record<string, unknown>;
          detail = {
            laps: d.laps != null ? Number(d.laps) : undefined,
            average_swolf: d.average_swolf != null ? Number(d.average_swolf) : undefined,
            pool_length: d.pool_length != null ? Number(d.pool_length) : undefined,
          };
        } catch {
          detail = null;
        }
      }
      workouts.push(mapStravaActivity(a, detail));
    }

    return { workouts };
  }
}
