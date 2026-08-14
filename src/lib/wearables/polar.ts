/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/polar.ts

وظيفة الملف:
"المحوّل الفعلي" (Adapter) لساعات Polar — يستقبل البيانات من
Polar AccessLink API v3 ويحوّلها للصيغة الموحّدة عبر
polar-mapping.ts، مع تسجيل المستخدم لدى Polar وتجديد التوكن
تلقائيًا.

لماذا نحتاجه؟
Polar ممتازة في تدريبات السباحة مع نبض القلب. بدل كتابة
منطقها في كل مكان، نضعه كله هنا: رابط الربط، تسجيل المستخدم
(ensureUser)، جلب النشاط والنوم والنبض والوزن والتدريبات،
وتجديد التوكن. هو "مترجم من لغة Polar إلى لغة الموقع".

متى يعمل؟
- عند بدء الربط من المتصفح (connect).
- عند المزامنة الدورية أو اليدوية (sync / getWorkouts).

من يستدعيه؟
- src/lib/wearables/adapters.ts (يرجعه كمحوّل عند طلب polar).
- src/lib/wearables/sync.ts (للمزامنة).

الملفات التي يتعامل معها:
- ./types: الواجهة الموحّدة WearableProviderAdapter.
- ./polar-mapping: تحويل اسم الرياضة والمدة إلى الصيغة الموحّدة.
- src/lib/crypto.ts: تشفير/فك تشفير التوكنات.
- src/lib/prisma.ts: قراءة/تحديث اتصال المستخدم.

ترتيب العمل:
connect (رابط الإذن) ← callback يخزن التوكن ← sync: تسجيل
المستخدم ← جلب 7 أيام (نشاط+نوم+نبض+وزن) + تدريبات ←
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

// من ملف محلي ./polar-mapping: "قاموس الترجمة" — تحويل اسم
// الرياضة والمدة إلى الصيغة الموحّدة.
import { mapPolarSport, parsePolarDuration } from './polar-mapping';

/**
 * جالب Polar الفعلي (Polar AccessLink API v3).
 * - OAuth من المتصفح عبر flow.polar.com — مجاني وسجل ذاتي.
 * - جلب تدريبات السباحة/الجري/الدراجة + النشاط اليومي + النوم + النبض + الوزن لآخر ٧ أيام.
 * - تجديد التوكن تلقائيًا عند الانتهاء.
 */

// ========================================
// 2. ثوابت الاتصال بموقع Polar
// ========================================

// عناوين Polar الرسمية (قاعدة API + نقطة تبديل التوكن).
const POLAR_BASE = 'https://www.polaraccesslink.com/v3';
const POLAR_TOKEN = 'https://polarremote.com/v2/oauth2/token';

// كم يومًا نرجع إلى الوراء عند المزامنة (آخر أسبوع).
const DAYS_BACK = 7;

// dateStr: تحويل تاريخ إلى نص YYYY-MM-DD (الصيغة التي تقبلها Polar).
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ========================================
// 3. المحوّل PolarAdapter
// ========================================

/*
-----------------------------------------
الصنف: PolarAdapter
-----------------------------------------
وظيفته: تنفيذ واجهة WearableProviderAdapter لصالح Polar —
        الربط، المزامنة، جلب التدريبات، تجديد التوكن،
        وتسجيل المستخدم لدى Polar.
id: يصرّح بنفسه كمزود 'polar'.
-----------------------------------------
*/
export class PolarAdapter implements WearableProviderAdapter {
  readonly id: WearableProviderId = 'polar';

  // connect: يبني رابط الإذن الرسمي (OAuth عبر flow.polar.com)
  // مع صلاحية الوصول الكامل accesslink.read_all.
  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    const clientId = process.env.POLAR_CLIENT_ID;
    if (!clientId) return { status: 'unsupported' };
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=polar`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'accesslink.read_all',
    });
    return { status: 'redirect', url: `https://flow.polar.com/oauth2/authorization?${params.toString()}` };
  }

  // disconnect: Polar لا يملك مسارًا موحّدًا للإلغاء —
  // يُترك الإلغاء يدويًا لدى Polar.
  async disconnect(_userId: string): Promise<void> {
    return undefined;
  }

  /*
  -----------------------------------------
  الدالة الداخلية: refreshIfNeeded
  -----------------------------------------
  وظيفتها: التأكد أن التوكن ساري، وتجديده تلقائيًا عند قرب انتهائه.
  Input: conn (الاتصال المحفوظ مع توكناته المشفرة).
  Processing: إن بقي أقل من 5 دقائق نطلب توكنًا جديدًا من Polar
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
    if (!access) throw new Error('لا يوجد توكن Polar — أعد الربط.');
    const expired = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expired) return access;

    const clientId = process.env.POLAR_CLIENT_ID ?? '';
    const clientSecret = process.env.POLAR_CLIENT_SECRET ?? '';
    const refresh = decryptText(conn.refreshToken);
    if (!clientId || !refresh) throw new Error('تعذر تجديد توكن Polar — أعد الربط.');

    const res = await fetch(POLAR_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error('فشل تجديد توكن Polar — أعد ربط الجهاز.');
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('فشل تجديد توكن Polar — أعد ربط الجهاز.');

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
  الدالة الداخلية: ensureUser
  -----------------------------------------
  وظيفتها: تسجيل المستخدم لدى Polar وإرجاع معرّفه (polar-user-id).
           Polar تتطلب هذا التسجيل قبل قراءة أي بيانات.
  Input: token (توكن وصول ساري).
  Processing: نرسل طلب POST فارغًا إلى /users. النجاح (200 أو 201)
              يعيد معرّف المستخدم. التكرار آمن — Polar تعيد نفس
              المعرّف لنفس المستخدم.
  Output: نص polar-user-id.
  يستدعيها: sync (في نفس الصنف).
  ماذا تستدعي: fetch.
  -----------------------------------------
  */
  /** تسجيل المستخدم لدى Polar وإرجاع polar-user-id (آمن التكرار). */
  private async ensureUser(token: string): Promise<string> {
    const res = await fetch(`${POLAR_BASE}/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`تعذر ربط حساب Polar (${res.status}) — أعد الربط.`);
    }
    const data = (await res.json()) as { 'polar-user-id'?: string | number };
    return String(data['polar-user-id'] ?? '');
  }

  // polarGet: دالة مساعدة داخلية ترسل طلب GET إلى Polar بحامل
  // التوكن. الأيام بلا بيانات تعيد أخطاء بلا نتيجة — نتجاهلها
  // ({}).
  private async polarGet(path: string, token: string): Promise<Record<string, unknown> | Array<Record<string, unknown>>> {
    const res = await fetch(`${POLAR_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error('توكن Polar غير صالح — أعد الربط.');
    if (!res.ok) return {}; // الأيام بلا بيانات تعيد أخطاء بلا نتيجة — نتجاهلها.
    return res.json() as Promise<Record<string, unknown> | Array<Record<string, unknown>>>;
  }

  // mapExercise: دالة مساعدة داخلية — تحوّل تمرين Polar خام إلى
  // الصيغة الموحّدة (تصنيف الرياضة + المدة + المسافة + النبض).
  private mapExercise(e: Record<string, unknown>): Record<string, unknown> {
    const sportType = mapPolarSport(String(e.sport ?? ''));
    const startTime = String(e.start_time ?? '');
    const durationMin = parsePolarDuration(e.duration as string | number | undefined);
    const distanceM = Number(e.distance ?? 0);
    const hr = (e.heart_rate as { average?: number } | undefined)?.average;
    return {
      sportType,
      startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      durationMin: durationMin ?? undefined,
      caloriesBurned: e.calories != null ? Number(e.calories) : undefined,
      distanceM: distanceM > 0 ? Math.round(distanceM) : undefined,
      externalId: String(e.id ?? ''),
      avgHeartRate: hr != null ? Math.round(hr) : undefined,
      intensity: undefined,
    };
  }

  /*
  -----------------------------------------
  الدالة: getWorkouts
  -----------------------------------------
  وظيفتها: جلب تدريبات آخر 30 يومًا من Polar.
  Input: token (توكن وصول ساري).
  Processing: نطلب /exercises ثم نترجم كل عنصر عبر mapExercise.
  Output: قائمة بالصيغة الموحّدة.
  يستدعيها: sync (في نفس الصنف).
  ماذا تستدعي: polarGet + mapExercise.
  -----------------------------------------
  */
  /** جلب تدريبات آخر ٣٠ يومًا. */
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = new Date();
    const res = await this.polarGet(`/exercises?start=${dateStr(start)}&end=${dateStr(end)}`, token);
    const list = Array.isArray(res) ? res : [];
    return list.map((e) => this.mapExercise(e as Record<string, unknown>));
  }

  /*
  -----------------------------------------
  الدالة: sync
  -----------------------------------------
  وظيفتها: مزامنة شاملة لآخر 7 أيام من Polar.
  Input: userId + التوكن (نهمله لأننا نقرأ من القاعدة).
  Processing: نجلب الاتصال المحفوظ ونضمن توكنًا ساريًا ونُسجّل
              المستخدم، ثم لكل يوم نجلب النشاط والنوم والنبض والوزن
              (كل طلب داخل try منفصل — أي فشل لا يوقف الباقي)،
              ثم نجلب التدريبات.
  Output: ProviderHealthData (نشاط + تدريبات + وزن).
  يستدعيها: sync.ts عبر runSyncConnection.
  ماذا تستدعي: refreshIfNeeded + ensureUser + getWorkouts + polarGet.
  -----------------------------------------
  */
  /** مزامنة شاملة لآخر ٧ أيام: تدريبات + نشاط + نوم + نبض + وزن. */
  async sync(userId: string, _token: string | null): Promise<ProviderHealthData> {
    const conn = await prisma.wearableConnection.findFirst({
      where: { userId, provider: 'polar', status: 'connected' },
      select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
    });
    if (!conn || !conn.accessToken) throw new ProviderNotConfiguredError('polar');
    const token = await this.refreshIfNeeded(conn);
    const polarUserId = await this.ensureUser(token);

    const today = new Date();
    const activity: Array<Record<string, unknown>> = [];
    const weight: Array<{ date: Date; weightKg: number }> = [];

    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const ds = dateStr(day);
      const row: Record<string, unknown> = { date: day.toISOString() };

      try {
        const act = (await this.polarGet(`/users/${polarUserId}/activity-log/${ds}`, token)) as {
          activity_log?: Array<{ active_calories?: number; calories?: number; steps?: number }>;
        };
        const a = act.activity_log?.[0];
        if (a) {
          row.steps = a.steps ?? 0;
          row.activeCalories = a.active_calories ?? undefined;
          row.totalCaloriesBurned = a.calories ?? undefined;
        }
      } catch {
        // يوم بلا نشاط.
      }

      try {
        const sleep = (await this.polarGet(`/users/${polarUserId}/activity-log/${ds}/sleep`, token)) as {
          sleep?: Array<{ start_time?: string; end_time?: string }>;
        };
        const s = sleep.sleep?.[0];
        if (s?.start_time && s?.end_time) {
          const minutes = Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000);
          if (minutes > 0 && minutes < 24 * 60) row.sleepMinutes = minutes;
        }
      } catch {
        // لا نوم.
      }

      try {
        const hr = (await this.polarGet(`/users/${polarUserId}/activity-log/${ds}/heart-rate`, token)) as {
          heart_rate?: Array<{ average?: number }>;
        };
        const avg = hr.heart_rate?.[0]?.average;
        if (avg != null) row.avgHeartRate = Math.round(avg);
      } catch {
        // لا نبض.
      }

      try {
        const w = (await this.polarGet(`/users/${polarUserId}/weight/${ds}`, token)) as {
          weight?: Array<{ weight?: number; date?: string }>;
        };
        const last = w.weight?.slice(-1)[0];
        if (last?.weight) {
          weight.push({ date: new Date(`${ds}T00:00:00`), weightKg: Math.round(last.weight * 100) / 100 });
        }
      } catch {
        // لا وزن.
      }

      if (row.steps != null || row.sleepMinutes != null || row.avgHeartRate != null || row.activeCalories != null) {
        activity.push(row);
      }
    }

    const workouts = await this.getWorkouts(token);
    return { activity: activity as unknown as ProviderHealthData['activity'], workouts, weight };
  }
}
