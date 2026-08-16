// أنواع نظام إنذار السلامة الذكي
// Smart Swimmer Safety & Emergency Alert System — Types

// ========================================
// 1. مستويات الخطورة
// ========================================
export const RiskLevel = {
  NORMAL: 'normal',
  ATTENTION: 'attention',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

// ألوان/أيقونات كل مستوى للعرض في الواجهة
export const RISK_LABELS: Record<RiskLevel, { ar: string; en: string; color: string; icon: string }> = {
  normal:    { ar: 'آمن',     en: 'SAFE',      color: 'emerald', icon: '✓' },
  attention: { ar: 'انتباه',  en: 'ATTENTION',  color: 'amber',   icon: '⚠' },
  warning:   { ar: 'تحذير',   en: 'WARNING',    color: 'orange',  icon: '⚡' },
  critical:  { ar: 'طوارئ',   en: 'CRITICAL',   color: 'red',     icon: '🚨' },
};

// ========================================
// 2. عيّنة قياس حيوية واحدة
// ========================================
export interface VitalReading {
  timestamp: Date | string;
  heartRate?: number | null;
  heartRateVariability?: number | null; // HRV
  spo2?: number | null;
  respiratoryRate?: number | null;
  bodyTemperature?: number | null;
  stressLevel?: number | null;
  steps?: number | null;
  caloriesBurned?: number | null;
  accelerometerX?: number | null;
  accelerometerY?: number | null;
  accelerometerZ?: number | null;
  gyroscopeX?: number | null;
  gyroscopeY?: number | null;
  gyroscopeZ?: number | null;
  movementMagnitude?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  batteryLevel?: number | null;
  isSwimming?: boolean;
  workoutStatus?: string | null;
  signalQuality?: string | null;
  provider?: string;
}

// ========================================
// 3. نتائج تحليل المؤشر
// ========================================
export interface VitalAssessment {
  indicator: string;
  label: string;
  value: number | null;
  baseline: number | null;
  severity: RiskLevel;
  message: string;
  deviationPercent?: number;
  durationSec?: number;
}

// ========================================
// 4. نتائج محرك المخاطر
// ========================================
export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  vitals: VitalAssessment[];
  activeIndicators: string[];
  isMovementAnomaly: boolean;
  isMultiIndicator: boolean;
  swimSessionActive: boolean;
  recommendedAction: string;
}

// ========================================
// 5. خط الأساس الديناميكي
// ========================================
export interface BaselineData {
  avgHeartRate: number | null;
  stdHeartRate: number | null;
  avgSpo2: number | null;
  stdSpo2: number | null;
  avgHrv: number | null;
  stdHrv: number | null;
  avgRespiratoryRate: number | null;
  stdRespiratoryRate: number | null;
  avgTemperature: number | null;
  stdTemperature: number | null;
  avgStress: number | null;
  avgMovement: number | null;
  stdMovement: number | null;
  sampleCount: number;
}

// ========================================
// 6. إعدادات السلامة
// ========================================
export interface SafetyThresholds {
  heartRateCriticalHigh: number;
  heartRateCriticalLow: number;
  heartRateWarningHigh: number;
  heartRateWarningLow: number;
  spo2CriticalLow: number;
  spo2WarningLow: number;
  respiratoryRateCriticalHigh: number;
  respiratoryRateCriticalLow: number;
  respiratoryRateWarningHigh: number;
  respiratoryRateWarningLow: number;
  hrvCriticalLow: number;
  hrvWarningLow: number;
  temperatureCriticalHigh: number;
  temperatureWarningHigh: number;
  temperatureCriticalLow: number;
  temperatureWarningLow: number;
  stressCriticalHigh: number;
  stressWarningHigh: number;
  noMovementDurationSec: number;
  noMovementSwimDurationSec: number;
  cooldownMinutes: number;
}

// ========================================
// 7. اتصال طوارئ
// ========================================
export interface EmergencyContactData {
  name: string;
  phone: string;
  relationship: string;
  priority: number;
  isPrimary?: boolean;
  notifyOnCritical?: boolean;
  notifyOnWarning?: boolean;
}

// ========================================
// 8. إجراء الإنذار
// ========================================
export interface AlertAction {
  type: 'push' | 'sound' | 'haptic' | 'sms' | 'dashboard';
  target: string; // userId أو contactId
  message: string;
  priority: RiskLevel;
}

// ========================================
// 9. بيانات Dashboard السلامة
// ========================================
export interface SafetyDashboardData {
  risk: RiskAssessment;
  latestVitals: VitalReading | null;
  lastUpdateAgo: string;
  activeAlerts: number;
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    description: string | null;
    createdAt: Date;
  }>;
  watchConnected: boolean;
  batteryLevel: number | null;
}

// ========================================
// 10. الثوابت الافتراضية
// ========================================
export const DEFAULT_THRESHOLDS: SafetyThresholds = {
  heartRateCriticalHigh: 200,
  heartRateCriticalLow: 40,
  heartRateWarningHigh: 180,
  heartRateWarningLow: 50,
  spo2CriticalLow: 88,
  spo2WarningLow: 92,
  respiratoryRateCriticalHigh: 30,
  respiratoryRateCriticalLow: 8,
  respiratoryRateWarningHigh: 25,
  respiratoryRateWarningLow: 10,
  hrvCriticalLow: 15,
  hrvWarningLow: 25,
  temperatureCriticalHigh: 39.5,
  temperatureWarningHigh: 38.5,
  temperatureCriticalLow: 35.0,
  temperatureWarningLow: 36.0,
  stressCriticalHigh: 90,
  stressWarningHigh: 75,
  noMovementDurationSec: 60,
  noMovementSwimDurationSec: 30,
  cooldownMinutes: 5,
};
