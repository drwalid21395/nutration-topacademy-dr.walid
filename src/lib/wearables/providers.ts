import { WearableProviderId, WearableProviderMeta } from './types';

/**
 * سجل المزودين (Provider Registry).
 * `configured` تُحسب من وجود بيانات الاعتماد في البيئة — لا نفترض ربطًا وهميًا.
 * أي مزود بلا بيانات اعتماد يظهر «قريبًا» أو يُوجَّه عبر Aggregator رسمي (Health Connect / Apple Health).
 */

interface ProviderEnv {
  clientIdEnv: string;
  clientSecretEnv?: string;
  /** مزود وسيط رسمي يُمرَّر عبره الجهاز (لا تفترض ربطًا مباشرًا بالمتصفح). */
  viaAggregator?: string;
}

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
  manual: { clientIdEnv: '' },
};

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
  { id: 'manual', nameAr: 'إدخال يدوي', nameEn: 'Manual entry', requiresOAuth: false, configured: true, available: true, descriptionAr: 'بديل متاح دائمًا — سجّل نشاطك وتدريباتك بنفسك دون أي ربط.' },
];

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

export function isProviderConfigured(id: string): boolean {
  const env = ENV[id];
  if (!env) return false;
  if (!env.clientIdEnv) return true; // manual
  return Boolean(process.env[env.clientIdEnv]);
}

export function getProviderEnv(id: string): ProviderEnv | undefined {
  return ENV[id];
}
