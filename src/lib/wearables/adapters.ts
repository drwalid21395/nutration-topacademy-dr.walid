/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/adapters.ts

وظيفة الملف:
"سجل المحوّلات" (Adapter Registry) — الفكرة ببساطة:
المحوّل (Adapter) مثل "مترجم" يترجم لغة كل ساعة إلى لغة
الموقع الموحّدة. هذا الملف يعرف أي محوّل يجب استعماله لأي
مزود، ويوفر أيضًا "محوّلًا عامًا" (GenericOAuthAdapter)
للمزودين غير الجاهزين بالكامل.

لماذا نحتاجه؟
بدلًا من أن تعرف بقية الملفات تفاصيل كل ساعة، نطلب من هنا
فقط: getAdapter('fitbit') ويعطينا المترجم المناسب.

متى يعمل؟
عند بدء الربط (connect) أو عند المزامنة (sync) أو فصل الجهاز.

من يستدعيه؟
- src/lib/wearables/sync.ts (لجلب المحوّل قبل المزامنة).
- واجهات API الخاصة بالربط وفصل الأجهزة.

الملفات التي يتعامل معها:
- ./types: الواجهة الموحّدة WearableProviderAdapter.
- ./providers: فحص وجود بيانات الاعتماد في البيئة.
- ./strava، ./polar، ./fitbit، ./oura: المحوّلات الجاهزة فعليًا.

فكرة المحوّل (Adapters) ببساطة:
الساعة تتكلم "لغتها" (JSON خاص بها)، والموقع يفهم "لغة موحّدة".
المحوّل يجلس بينهما: يستقبل بيانات الساعة الخام ويعيدها
بالشكل الذي يفهمه الموقع — مثل ترجمة من لغة الساعة إلى لغة الموقع.

ترتيب العمل:
getAdapter(id) ← يرجع المحوّل الصحيح ← المتصل يستعمل
connect/sync/getWorkouts/disconnect
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// من ملف محلي ./types: الواجهة الموحّدة لكل المحوّلات + الخطأ
// الموحّد + شكل بيانات المزود الخام.
import { WearableProviderAdapter, ProviderNotConfiguredError, ProviderHealthData } from './types';
// من ملف محلي ./providers: دوال فحص وجود بيانات الاعتماد
// وجلب أسماء متغيرات البيئة لكل مزود.
import { isProviderConfigured, getProviderEnv } from './providers';

// من ملفات محلية: المحوّلات "الجاهزة" التي تجلب البيانات فعليًا
// لكل ساعة (الترجمة الفعلية من لغة الساعة إلى لغة الموقع).
import { StravaAdapter } from './strava';
import { PolarAdapter } from './polar';
import { FitbitAdapter } from './fitbit';
import { OuraAdapter } from './oura';

/**
 * قالب موحّد لـ OAuth 2.0 لكل مزود.
 * لا يُنشأ أي ربط وهمي: إذا لم توجد بيانات اعتماد في البيئة يظهر «قريبًا».
 * نقطة الاتصال المباشرة للمتصفح تكون عبر المزود أو الـ Aggregator الرسمي
 * (Apple Health / Health Connect …) حسب سياسات كل منصة.
 */

// ========================================
// 2. جدول إعدادات OAuth لكل مزود
// ========================================

// OAuthConfig: إعدادات الربط عبر OAuth 2.0
// (رابط صفحة الإذن + رابط تبديل التوكن + الصلاحيات المطلوبة).
interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl?: string;
  scopes: string[];
}

// OAUTH: قاموس يجمع روابط الربط والصلاحيات لكل منصة.
// لاحظ: المزودون الذين روابطهم فارغة (authorizeUrl: '') يحتاجون
// تطبيق موبايل أو Aggregator رسمي (Apple Health / Health Connect...)
// ولا يمكن ربطهم مباشرة من المتصفح.
const OAUTH: Record<string, OAuthConfig> = {
  fitbit: {
    authorizeUrl: 'https://www.fitbit.com/oauth2/authorize',
    tokenUrl: 'https://api.fitbit.com/oauth2/token',
    scopes: ['activity', 'heartrate', 'sleep', 'weight', 'profile'],
  },
  garmin: {
    authorizeUrl: 'https://connect.garmin.com/oauth2/authorize',
    tokenUrl: 'https://connect.garmin.com/oauth2/token',
    scopes: ['activity', 'heart_rate', 'sleep', 'weight', 'user_profile'],
  },
  huawei: {
    authorizeUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/authorize',
    tokenUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/token',
    scopes: ['openid', 'profile', 'health'],
  },
  honor: {
    authorizeUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/authorize',
    tokenUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/token',
    scopes: ['openid', 'profile', 'health'],
  },
  polar: {
    authorizeUrl: 'https://flow.polar.com/oauth2/authorization',
    tokenUrl: 'https://polarremote.com/v2/oauth2/token',
    scopes: ['accesslink.read_all'],
  },
  whoop: {
    authorizeUrl: 'https://api-oauth.whoop.com/oauth/authorize',
    tokenUrl: 'https://api-oauth.whoop.com/oauth/token',
    scopes: ['read:recovery', 'read:cycles', 'read:workout', 'read:sleep', 'read:profile', 'read:body_measurement'],
  },
  oura: {
    authorizeUrl: 'https://cloud.ouraring.com/oauth/authorize',
    tokenUrl: 'https://api.ouraring.com/oauth/token',
    scopes: ['daily', 'heartrate', 'personal', 'session', 'sleep', 'tag', 'workout'],
  },
  strava: {
    authorizeUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    scopes: ['read', 'activity:read_all', 'profile:read_all'],
  },
  samsungHealth: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  appleHealth: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  healthConnect: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  xiaomi: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  amazfit: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
};

// ========================================
// 3. المحوّل العام OAuth والمصنع (Factory)
// ========================================

/*
-----------------------------------------
الصنف: GenericOAuthAdapter
-----------------------------------------
وظيفته: محوّل "عام" لأي مزود يستخدم OAuth القياسي.
         للروابط غير الجاهزة (مثل Apple/Health Connect) يعيد
         حالة «قريبًا» أو يوجّه عبر Aggregator، ولا يُنشئ ربطًا وهميًا.
constructor: يستقبل id المزود (WearableProviderId2).
-----------------------------------------
*/
export class GenericOAuthAdapter implements WearableProviderAdapter {
  constructor(readonly id: WearableProviderId2) {}

  // connect: يبني رابط الإذن. إن لم تُركّب بيانات الاعتماد نعود
  // 'unsupported'؛ وإن لم يوجد رابط (مزود يحتاج تطبيق موبايل)
  // نعود 'configured'؛ وإلا نبني الرابط بكل المعاملات ونعود 'redirect'.
  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    if (!isProviderConfigured(this.id)) {
      return { status: 'unsupported' };
    }
    const cfg = OAUTH[this.id];
    if (!cfg?.authorizeUrl) {
      // المزود يتطلب مسار موبايل/تطبيق صحي — لا يمكن ربطه مباشرة بالمتصفح.
      return { status: 'configured' };
    }
    const env = getProviderEnv(this.id);
    const clientId = env?.clientIdEnv ? (process.env[env.clientIdEnv] ?? '') : '';
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=${this.id}`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId ?? '',
      redirect_uri: redirectUri,
      scope: cfg.scopes.join(' '),
    });
    return { status: 'redirect', url: `${cfg.authorizeUrl}?${params.toString()}` };
  }

  // disconnect: فصل الجهاز — عادة لا يوجد مسار موحّد، فيُترك
  // إبطال الصلاحيات يدويًا لدى المزود.
  async disconnect(_userId: string): Promise<void> {
    // عادة لا يوجد endpoint موحد — يتم إبطال الصلاحيات محليًا لدى المزود يدويًا.
    return undefined;
  }

  // sync: جلب بيانات المزود. هنا (للمزود العام) لا يوجد جلب فعلي
  // بعد — يُنفَّذ لكل مزود عند توفّر بيانات الاعتماد في البيئة.
  async sync(_userId: string, token: string | null): Promise<ProviderHealthData> {
    if (!token) throw new ProviderNotConfiguredError(this.id);
    // يتم تنفيذ الجلب الفعلي لكل مزود عند توفّر بيانات الاعتماد في البيئة.
    return { activity: [], workouts: [] };
  }

  // getWorkouts: جلب قائمة التدريبات — فارغة حاليًا للمزود العام.
  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    if (!token) throw new ProviderNotConfiguredError(this.id);
    return [];
  }
}

// WearableProviderId2: قائمة المزودين الذين يدعمهم المحوّل العام
// (نفس قائمة types تقريبًا، لكن من دون 'honor' و 'manual').
type WearableProviderId2 = 'fitbit' | 'garmin' | 'huawei' | 'polar' | 'whoop' | 'oura' | 'strava' | 'samsungHealth' | 'appleHealth' | 'healthConnect' | 'xiaomi' | 'amazfit';

/*
-----------------------------------------
الدالة: getAdapter (مصدَّرة — "المصنع" Factory)
-----------------------------------------
وظيفتها: إرجاع المحوّل (المترجم) الصحيح حسب اسم المزود.
Input: id (اسم المزود كنص، مثل 'strava').
Processing: للمزودين الجاهزين تعيد كائنًا جديدًا من محوّلهم
            (Strava/Polar/Fitbit/Oura)، وللبقية محوّلًا عامًا.
Output: كائن يطبّق واجهة WearableProviderAdapter.
يستدعيها: sync.ts وواجهات API الخاصة بالربط.
ماذا تستدعي: مُنشِئات (Constructors) المحوّلات في نفس المجلد.
-----------------------------------------
*/
export function getAdapter(id: string): WearableProviderAdapter {
  if (id === 'strava') return new StravaAdapter();
  if (id === 'polar') return new PolarAdapter();
  if (id === 'fitbit') return new FitbitAdapter();
  if (id === 'oura') return new OuraAdapter();
  return new GenericOAuthAdapter(id as WearableProviderId2);
}
