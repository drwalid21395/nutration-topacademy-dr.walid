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
  | 'xiaomi'
  | 'amazfit'
  | 'polar'
  | 'whoop'
  | 'oura'
  | 'strava'
  | 'manual';

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
}

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

/** تحميل بيانات أولية من مزود (قبل التطبيع). */
export interface ProviderHealthData {
  activity?: Partial<UnifiedDailyActivity>[];
  workouts?: Array<Record<string, unknown>>;
  sleep?: Array<Record<string, unknown>>;
  weight?: Array<{ date: Date; weightKg: number }>;
}

export interface SyncResult {
  activityUpserted: number;
  workoutsUpserted: number;
  duplicated: number;
  message: string;
}

/** واجهة موحدة لكل مزود — تنفيذها الملموس لكل منصة. */
export interface WearableProviderAdapter {
  readonly id: WearableProviderId;
  connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }>;
  disconnect(userId: string): Promise<void>;
  sync(userId: string, token: string | null): Promise<ProviderHealthData>;
  /** جلب جلسات سباحة أو تدريب. */
  getWorkouts(token: string): Promise<Record<string, unknown>[]>;
}

/** أخطاء موحدة. */
export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`المزود ${providerId} غير مكوَّن في البيئة (لا توجد بيانات اعتماد OAuth).`);
    this.name = 'ProviderNotConfiguredError';
  }
}
