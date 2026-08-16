/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/providers.ts

وظيفة الملف:
"سجل المزودين" (Provider Registry) — يحوي قائمة كل منصات
الساعات المدعومة (أسماؤها ووصفها)، وأسماء متغيرات البيئة
اللازمة لكل منها، ودوالًا تعرف هل المزود "مُهيأ" (توجد بيانات
اعتماده في البيئة) و"متاح" للربط أم لا.

لماذا نحتاجه؟
حتى لا نكتب قائمة الساعات في كل ملف، وأهم من ذلك: لا نفترض
ربطًا وهميًا. أي مزود بلا بيانات اعتماد يظهر «قريبًا» أو
يُوجَّه عبر Aggregator رسمي (Health Connect / Apple Health).

متى يعمل؟
عند عرض صفحة ربط الأجهزة، وعند بناء رابط الإذن في adapters.ts.

من يستدعيه؟
- src/lib/wearables/adapters.ts (isProviderConfigured / getProviderEnv).
- صفحات وواجهات API الخاصة بربط الأجهزة (PROVIDERS / getProviderMeta).

الملفات التي يتعامل معها:
- ./types: WearableProviderId و WearableProviderMeta.

ترتيب العمل:
PROVIDERS (القائمة) ← getProviderMeta (يتحقق من البيئة) ←
isProviderConfigured / getProviderEnv للمعالجة
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// من ملف محلي ./types: معرّف المزود ووصفه التعريفي.
import { WearableProviderId, WearableProviderMeta } from './types';

/**
 * سجل المزودين (Provider Registry).
 * `configured` تُحسب من وجود بيانات الاعتماد في البيئة — لا نفترض ربطًا وهميًا.
 * أي مزود بلا بيانات اعتماد يظهر «قريبًا» أو يُوجَّه عبر Aggregator رسمي (Health Connect / Apple Health).
 */

// ========================================
// 2. أسماء متغيرات البيئة لكل مزود
// ========================================

// ProviderEnv: كيف نجد بيانات اعتماد المزود في البيئة؟
// clientIdEnv: اسم متغير الـ Client ID (مثل FITBIT_CLIENT_ID).
// clientSecretEnv: اسم متغير السر (اختياري).
// viaAggregator: إن وُجد، فالجهاز يمر عبر "مزود وسيط رسمي"
// (مثل Health Connect أو Apple Health) ولا يُربط مباشرة بالمتصفح.
interface ProviderEnv {
  clientIdEnv: string;
  clientSecretEnv?: string;
  /** مزود وسيط رسمي يُمرَّر عبره الجهاز (لا تفترض ربطًا مباشرًا بالمتصفح). */
  viaAggregator?: string;
}

// ENV: قاموس يربط اسم المزود بأسماء متغيرات البيئة الخاصة به.
// ملاحظة: honor يستخدم نفس متغيرات huawei (نفس المنصة خلف الكواليس)،
// و manual لا يحتاج أي متغيرات (clientIdEnv فارغ).
const ENV: Record<string, ProviderEnv> = {
  appleHealth: { clientIdEnv: 'APPLE_HEALTH_CLIENT_ID', viaAggregator: 'Apple Health' },
  healthConnect: { clientIdEnv: 'HEALTH_CONNECT_CLIENT_ID', viaAggregator: 'Android Health Connect' },
  samsungHealth: { clientIdEnv: 'SAMSUNG_HEALTH_CLIENT_ID', viaAggregator: 'Samsung Health' },
  fitbit: { clientIdEnv: 'FITBIT_CLIENT_ID', clientSecretEnv: 'FITBIT_CLIENT_SECRET' },
  garmin: { clientIdEnv: 'GARMIN_CLIENT_ID', clientSecretEnv: 'GARMIN_CLIENT_SECRET' },
  huawei: { clientIdEnv: 'HUAWEI_CLIENT_ID', clientSecretEnv: 'HUAWEI_CLIENT_SECRET' },
  honor: { clientIdEnv: 'HUAWEI_CLIENT_ID', clientSecretEnv: 'HUAWEI_CLIENT_SECRET' },
  xiaomi: { clientIdEnv: 'XIAOMI_CLIENT_ID', viaAggregator: 'Health Connect' },
  amazfit: { clientIdEnv: 'ZEpp_CLIENT_ID', clientSecretEnv: 'ZEPP_CLIENT_SECRET' },
  polar: { clientIdEnv: 'POLAR_CLIENT_ID', clientSecretEnv: 'POLAR_CLIENT_SECRET' },
  whoop: { clientIdEnv: 'WHOOP_CLIENT_ID', clientSecretEnv: 'WHOOP_CLIENT_SECRET' },
  oura: { clientIdEnv: 'OURA_CLIENT_ID', clientSecretEnv: 'OURA_CLIENT_SECRET' },
  strava: { clientIdEnv: 'STRAVA_CLIENT_ID', clientSecretEnv: 'STRAVA_CLIENT_SECRET' },
  mobile: { clientIdEnv: '' },
  manual: { clientIdEnv: '' },
};

// ========================================
// 3. القائمة العامة للمزودين
// ========================================

// PROVIDERS: قائمة كل المزودين ببيانات العرض (اسم عربي/إنجليزي
// + هل يتطلب OAuth + وصف للمستخدم). الحقول configured/available
// تُحدَّث لاحقًا في getProviderMeta حسب البيئة، وهي هنا قيم
// ابتدائية ثابتة.
export const PROVIDERS: WearableProviderMeta[] = [
  { id: 'appleHealth', nameAr: 'Apple Health', nameEn: 'Apple Health', requiresOAuth: true, configured: false, available: false, descriptionAr: 'لأجهزة Apple Watch — يُربط حاليًا عبر تطبيق Apple Health على آيفون، ويتطلب تطبيق موبايل (HealthKit) لاستيراد البيانات.' },
  { id: 'healthConnect', nameAr: 'Health Connect (أندرويد)', nameEn: 'Health Connect', requiresOAuth: true, configured: false, available: false, descriptionAr: 'المجمّع الرسمي لأنظمة أندرويد (Galaxy Watch و Pixel Watch و Xiaomi وغيرها) — يتطلب تطبيق موبايل لقراءة البيانات.' },
  { id: 'samsungHealth', nameAr: 'Samsung Health', nameEn: 'Samsung Health', requiresOAuth: true, configured: false, available: false, descriptionAr: 'لأجهزة Galaxy Watch — يمر عبر Health Connect، ويتطلب تطبيق موبايل.' },
  { id: 'fitbit', nameAr: 'Fitbit', nameEn: 'Fitbit', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Fitbit Web API الرسمي — يربط من المتصفح مباشرة، يشمل النشاط والنوم والنبض والوزن والتدريبات.' },
  { id: 'garmin', nameAr: 'Garmin', nameEn: 'Garmin', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Garmin Health API — يتطلب شراكة رسمية وموافقة من Garmin.' },
  { id: 'huawei', nameAr: 'Huawei Health', nameEn: 'Huawei Health', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Huawei Health Kit — يتطلب حساب مطوّر وموافقة رسمية.' },
  { id: 'honor', nameAr: 'Honor Health', nameEn: 'Honor Health', requiresOAuth: true, configured: false, available: false, descriptionAr: 'ساعات Honor (مثل Watch GS و Band) تستخدم تطبيق Huawei Health — تُربط عبر Huawei Health Kit، ويتطلب حساب مطوّر وموافقة رسمية.' },
  { id: 'xiaomi', nameAr: 'Xiaomi / Mi Fitness', nameEn: 'Xiaomi Mi Fitness', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Health Connect أو تطبيق Mi Fitness — يتطلب تطبيق موبايل.' },
  { id: 'amazfit', nameAr: 'Amazfit / Zepp', nameEn: 'Amazfit / Zepp', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Zepp API الرسمي أو Health Connect — يتطلب شراكة أو تطبيق موبايل.' },
  { id: 'polar', nameAr: 'Polar', nameEn: 'Polar', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Polar AccessLink — مجاني وفوري، تدريبات السباحة مع نبض القلب والنشاط والنوم والوزن.' },
  { id: 'whoop', nameAr: 'WHOOP', nameEn: 'WHOOP', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر WHOOP API الرسمي — يتطلب شراكة رسمية.' },
  { id: 'oura', nameAr: 'Oura', nameEn: 'Oura', requiresOAuth: true, configured: false, available: false, descriptionAr: 'عبر Oura Cloud API الرسمي — يربط من المتصفح مباشرة، يشمل النشاط والنوم والنبض والتدريبات.' },
  { id: 'strava', nameAr: 'Strava', nameEn: 'Strava', requiresOAuth: true, configured: false, available: false, descriptionAr: 'تجميع التدريبات (سباحة/جري/دراجة) من معظم الساعات — يربط من المتصفح مباشرة عبر Strava API.' },
  { id: 'mobile', nameAr: 'تطبيق الموبايل (Health Connect)', nameEn: 'Mobile App (Health Connect)', requiresOAuth: false, configured: true, available: true, descriptionAr: 'تطبيق توب أكاديمي على هاتفك يقرأ بيانات ساعتك عبر Health Connect ويرسلها تلقائيًا — بديل لكل الشركات الأخرى.' },
  { id: 'manual', nameAr: 'إدخال يدوي', nameEn: 'Manual entry', requiresOAuth: false, configured: true, available: true, descriptionAr: 'بديل متاح دائمًا — سجّل نشاطك وتدريباتك بنفسك دون أي ربط.' },
];

// ========================================
// 4. دوال الاستعلام عن المزودين
// ========================================

/*
-----------------------------------------
الدالة: getProviderMeta (مصدَّرة)
-----------------------------------------
وظيفتها: إرجاع وصف مزود مع حساب حالته الحقيقية (configured/available).
Input: id (اسم المزود).
Processing: نبحث في PROVIDERS؛ إن لم يوجد نبني وصفًا عامًا بسيطًا.
            ثم نحدد configured من وجود متغيرات البيئة، و available
            بـ: الإدخال اليدوي دائمًا متاح، والمزود متاح عندما يكون
            مُهيأً ولا يحتاج Aggregator وسيطًا.
Output: WearableProviderMeta.
يستدعيها: صفحات/واجهات ربط الأجهزة.
ماذا تستدعي: ENV و process.env.
-----------------------------------------
*/
export function getProviderMeta(id: string): WearableProviderMeta {
  const meta = PROVIDERS.find((p) => p.id === id);
  if (!meta) return {
    id: id as WearableProviderId,
    nameAr: id,
    nameEn: id,
    requiresOAuth: true,
    configured: false,
    available: false,
    descriptionAr: '',
  };
  const env = ENV[id];
  const viaAggregator = env?.viaAggregator;
  const configured = !env?.clientIdEnv ? true : Boolean(process.env[env.clientIdEnv]);
  const available = meta.id === 'manual' ? true : configured && !viaAggregator;
  return { ...meta, configured, available };
}

/*
-----------------------------------------
الدالة: isProviderConfigured (مصدَّرة)
-----------------------------------------
وظيفتها: هل المزود "مُهيأ" (توجد بيانات اعتماده في البيئة)؟
Input: id.
Processing: إن لم يكن في سجل ENV → false. إن كان لا يحتاج Client ID
            (manual) → true. وإلا نتحقق من وجود المتغير.
Output: boolean.
يستدعيها: adapters.ts (قبل بناء رابط الإذن).
-----------------------------------------
*/
export function isProviderConfigured(id: string): boolean {
  const env = ENV[id];
  if (!env) return false;
  if (!env.clientIdEnv) return true; // manual
  return Boolean(process.env[env.clientIdEnv]);
}

/*
-----------------------------------------
الدالة: getProviderEnv (مصدَّرة)
-----------------------------------------
وظيفتها: إرجاع إعدادات البيئة الخاصة بمزود.
Output: ProviderEnv أو undefined.
يستدعيها: adapters.ts (لقراءة أسماء متغيرات Client ID).
-----------------------------------------
*/
export function getProviderEnv(id: string): ProviderEnv | undefined {
  return ENV[id];
}
