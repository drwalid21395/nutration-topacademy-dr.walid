/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/types.ts

وظيفة الملف:
تعريف كل "الأشكال" التي تستعملها طبقة تكامل الساعات الذكية:
قائمة المزودين، بيانات النشاط والتدريب "الموحّدة"، واجهة
المحوّل (Adapter)، والخطأ الموحّد.

لماذا نحتاجه؟
هذا قلب فكرة Provider-Agnostic: مهما كانت الساعة (Fitbit,
Strava, Oura, Polar...)، بعد التطبيع تصبح بياناتها بهذه
الصيغ الموحّدة تمامًا. بقية المشروع لا يرى تفاصيل كل ساعة
أبدًا — فقط هذه الأنواع.

من يستخدمه؟
كل ملفات مجلد wearables (adapters, sync, normalize, dedupe,
والجالبون الأربعة) — لأنهم جميعًا يتعاملون بنفس الصيغ.

ملاحظة:
ملف "أنواع" فقط — لا يحتوي على كود يُنفَّذ وقت التشغيل،
باستثناء تعريف الخطأ ProviderNotConfiguredError.
=================================================
*/

// ========================================
// 1. المزودون وبياناتهم التعريفية
// ========================================

/**
 * طبقة تكامل الساعات الذكية (Wearable Integration Layer)
 * نظام Provider-Agnostic: كل المزودين يُحوَّلون إلى صيغة موحدة هنا.
 */

/** المزودون المدعومون (تُضاف أي منصة مستقبلًا دون إعادة بناء النظام). */
export type WearableProviderId =
  | 'appleHealth'
  | 'healthConnect'
  | 'samsungHealth'
  | 'fitbit'
  | 'garmin'
  | 'huawei'
  | 'honor'
  | 'xiaomi'
  | 'amazfit'
  | 'polar'
  | 'whoop'
  | 'oura'
  | 'strava'
  | 'mobile'
  | 'manual';

// WearableProviderMeta: وصف مزود للعرض في واجهة ربط الأجهزة
// (الأسماء + هل يتطلب OAuth + هل مُهيأ/متاح + وصف للمستخدم).
export interface WearableProviderMeta {
  id: WearableProviderId;
  nameAr: string;
  nameEn: string;
  /** هل تتطلب بيانات OAuth من البيئة (Client ID/Secret)؟ */
  requiresOAuth: boolean;
  /** هل رُكّبت بيانات الاعتماد في البيئة؟ */
  configured: boolean;
  /** هل يمكن الربط من خلال هذا المزود الآن؟ */
  available: boolean;
  /** وصف مختصر للمستخدم. */
  descriptionAr: string;
}

// ConnectionInfo: شكل "اتصال الجهاز" المحفوظ — المزود وحالته
// وآخر مزامنة وخطأها والمصدر.
export interface ConnectionInfo {
  id: string;
  provider: WearableProviderId;
  providerName: string;
  status: string;
  deviceName?: string | null;
  scopes: string[];
  lastSyncAt?: Date | null;
  lastSyncError?: string | null;
  source: string;
  consentAt?: Date | null;
}

// ========================================
// 2. الصيغ الموحّدة (بعد التطبيع)
// ========================================

// UnifiedDailyActivity: "لغة الموقع" للنشاط اليومي — كل المزودين
// يُحوَّلون إلى هذا الشكل قبل الدخول إلى قاعدة البيانات.
/** صيغة موحدة لبيانات النشاط اليومي (بعد التطبيع). */
export interface UnifiedDailyActivity {
  date: Date;
  steps?: number;
  distanceM?: number;
  activeCalories?: number;
  restingCalories?: number;
  workoutCalories?: number;
  totalCaloriesBurned?: number;
  workoutMinutes?: number;
  sleepMinutes?: number;
  avgHeartRate?: number;
  restingHeartRate?: number;
  avgSpo2?: number;
}

// UnifiedWorkout: "لغة الموقع" لجلسة التدريب — تتضمن بيانات
// السباحة عند توفرها (لفات، SWOLF، طول المسبح...).
/** صيغة موحدة لجلسة تدريب (تتضمن بيانات السباحة عند توفرها). */
export interface UnifiedWorkout {
  startTime: Date;
  sportType: string; // swim | gym | run | cycle | walk | other
  durationMin?: number;
  caloriesBurned?: number;
  distanceM?: number;
  intensity?: string;
  provider?: string;
  externalId?: string;
  laps?: number;
  poolLengthM?: number;
  strokeType?: string;
  avgPacePer100m?: number;
  swolf?: number;
  avgHeartRate?: number;
  confidence?: 'high' | 'medium' | 'estimated';
}

// ProviderHealthData: "شحنة" البيانات الخام القادمة من المزود
// (قبل التطبيع) — نشاط وتدريبات ونوم ووزن.
/** تحميل بيانات أولية من مزود (قبل التطبيع). */
export interface ProviderHealthData {
  activity?: Partial<UnifiedDailyActivity>[];
  workouts?: Array<Record<string, unknown>>;
  sleep?: Array<Record<string, unknown>>;
  weight?: Array<{ date: Date; weightKg: number }>;
}

// SyncResult: ملخص عملية المزامنة (كم سجل نشاط/تدريب أُدخل
// + عدد التكرارات + رسالة للمستخدم).
export interface SyncResult {
  activityUpserted: number;
  workoutsUpserted: number;
  duplicated: number;
  message: string;
}

// ========================================
// 3. واجهة المحوّل والخطأ الموحّد
// ========================================

// WearableProviderAdapter: "العقد" الذي يوقّعه كل محوّل —
// أي مزود جديد يجب أن ينفّذ هذه الدوال الأربع (connect,
// disconnect, sync, getWorkouts) كي يتكامل مع النظام.
/** واجهة موحدة لكل مزود — تنفيذها الملموس لكل منصة. */
export interface WearableProviderAdapter {
  readonly id: WearableProviderId;
  connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }>;
  disconnect(userId: string): Promise<void>;
  sync(userId: string, token: string | null): Promise<ProviderHealthData>;
  /** جلب جلسات سباحة أو تدريب. */
  getWorkouts(token: string): Promise<Record<string, unknown>[]>;
}

// ProviderNotConfiguredError: خطأ موحّد يُرمى عندما نحاول
// استعمال مزود لا توجد بيانات اعتماده في البيئة (OAuth).
/** أخطاء موحدة. */
export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`المزود ${providerId} غير مكوَّن في البيئة (لا توجد بيانات اعتماد OAuth).`);
    this.name = 'ProviderNotConfiguredError';
  }
}
