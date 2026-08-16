// محرك تقييم الخطورة — Risk Engine
// يحلل جميع المؤشرات ويحسب درجة الخطورة الشاملة

import { prisma } from '@/lib/prisma';
import type { VitalReading, VitalAssessment, RiskAssessment, RiskLevel, SafetyThresholds } from './types';
import { DEFAULT_THRESHOLDS } from './types';
import { getBaseline, updateBaseline } from './baseline';
import { analyzeMovement } from './movement-analyzer';

// جلب إعدادات السلامة للمستخدم
async function getThresholds(userId: string): Promise<SafetyThresholds> {
  const settings = await prisma.safetySettings.findUnique({ where: { userId } });
  if (!settings) return DEFAULT_THRESHOLDS;
  return {
    heartRateCriticalHigh: settings.heartRateCriticalHigh ?? DEFAULT_THRESHOLDS.heartRateCriticalHigh,
    heartRateCriticalLow: settings.heartRateCriticalLow ?? DEFAULT_THRESHOLDS.heartRateCriticalLow,
    heartRateWarningHigh: settings.heartRateWarningHigh ?? DEFAULT_THRESHOLDS.heartRateWarningHigh,
    heartRateWarningLow: settings.heartRateWarningLow ?? DEFAULT_THRESHOLDS.heartRateWarningLow,
    spo2CriticalLow: settings.spo2CriticalLow ?? DEFAULT_THRESHOLDS.spo2CriticalLow,
    spo2WarningLow: settings.spo2WarningLow ?? DEFAULT_THRESHOLDS.spo2WarningLow,
    respiratoryRateCriticalHigh: settings.respiratoryRateCriticalHigh ?? DEFAULT_THRESHOLDS.respiratoryRateCriticalHigh,
    respiratoryRateCriticalLow: settings.respiratoryRateCriticalLow ?? DEFAULT_THRESHOLDS.respiratoryRateCriticalLow,
    respiratoryRateWarningHigh: settings.respiratoryRateWarningHigh ?? DEFAULT_THRESHOLDS.respiratoryRateWarningHigh,
    respiratoryRateWarningLow: settings.respiratoryRateWarningLow ?? DEFAULT_THRESHOLDS.respiratoryRateWarningLow,
    hrvCriticalLow: settings.hrvCriticalLow ?? DEFAULT_THRESHOLDS.hrvCriticalLow,
    hrvWarningLow: settings.hrvWarningLow ?? DEFAULT_THRESHOLDS.hrvWarningLow,
    temperatureCriticalHigh: settings.temperatureCriticalHigh ?? DEFAULT_THRESHOLDS.temperatureCriticalHigh,
    temperatureWarningHigh: settings.temperatureWarningHigh ?? DEFAULT_THRESHOLDS.temperatureWarningHigh,
    temperatureCriticalLow: settings.temperatureCriticalLow ?? DEFAULT_THRESHOLDS.temperatureCriticalLow,
    temperatureWarningLow: settings.temperatureWarningLow ?? DEFAULT_THRESHOLDS.temperatureWarningLow,
    stressCriticalHigh: settings.stressCriticalHigh ?? DEFAULT_THRESHOLDS.stressCriticalHigh,
    stressWarningHigh: settings.stressWarningHigh ?? DEFAULT_THRESHOLDS.stressWarningHigh,
    noMovementDurationSec: settings.noMovementDurationSec ?? DEFAULT_THRESHOLDS.noMovementDurationSec,
    noMovementSwimDurationSec: settings.noMovementSwimDurationSec ?? DEFAULT_THRESHOLDS.noMovementSwimDurationSec,
    cooldownMinutes: settings.cooldownMinutes ?? DEFAULT_THRESHOLDS.cooldownMinutes,
  };
}

// تقييم مؤشر واحد
function assessVital(
  indicator: string,
  label: string,
  value: number | null,
  baseline: number | null,
  thresholds: { criticalHigh?: number; criticalLow?: number; warningHigh?: number; warningLow?: number; std?: number },
): VitalAssessment {
  if (value == null) {
    return { indicator, label, value: null, baseline, severity: 'normal', message: 'لا توجد بيانات' };
  }

  const { criticalHigh, criticalLow, warningHigh, warningLow, std } = thresholds;

  // مقارنة بالقيم المطلقة أولاً
  if (criticalHigh != null && value >= criticalHigh) {
    return { indicator, label, value, baseline, severity: 'critical', message: `${label} مرتفع بشكل حرج (${value})`, deviationPercent: baseline ? ((value - baseline) / baseline) * 100 : undefined };
  }
  if (criticalLow != null && value <= criticalLow) {
    return { indicator, label, value, baseline, severity: 'critical', message: `${label} منخفض بشكل حرج (${value})`, deviationPercent: baseline ? ((baseline - value) / baseline) * 100 : undefined };
  }
  if (warningHigh != null && value >= warningHigh) {
    return { indicator, label, value, baseline, severity: 'warning', message: `${label} مرتفع (${value})`, deviationPercent: baseline ? ((value - baseline) / baseline) * 100 : undefined };
  }
  if (warningLow != null && value <= warningLow) {
    return { indicator, label, value, baseline, severity: 'warning', message: `${label} منخفض (${value})`, deviationPercent: baseline ? ((baseline - value) / baseline) * 100 : undefined };
  }

  // مقارنة بالانحراف عن خط الأساس
  if (baseline != null && std != null && std > 0) {
    const deviation = Math.abs(value - baseline);
    const zScore = deviation / std;
    if (zScore > 4) {
      return { indicator, label, value, baseline, severity: 'warning', message: `${label} بعيد عن المعتاد (${Math.round(zScore)}× انحراف)`, deviationPercent: ((value - baseline) / baseline) * 100 };
    }
    if (zScore > 3) {
      return { indicator, label, value, baseline, severity: 'attention', message: `${label} غير معتاد (${Math.round(zScore)}× انحراف)`, deviationPercent: ((value - baseline) / baseline) * 100 };
    }
  }

  return { indicator, label, value, baseline, severity: 'normal', message: `${label} طبيعي (${value})` };
}

// التقييم الشامل لreading واحد
export async function assessRisk(userId: string, reading: VitalReading): Promise<RiskAssessment> {
  const thresholds = await getThresholds(userId);
  const baseline = await getBaseline(userId);

  // تحليل المؤشرات الحيوية
  const vitals: VitalAssessment[] = [];

  // 1. النبض
  const hr = assessVital('heartRate', 'النبض', reading.heartRate ?? null, baseline?.avgHeartRate ?? null, {
    criticalHigh: thresholds.heartRateCriticalHigh,
    criticalLow: thresholds.heartRateCriticalLow,
    warningHigh: thresholds.heartRateWarningHigh,
    warningLow: thresholds.heartRateWarningLow,
    std: baseline?.stdHeartRate ?? undefined,
  });
  vitals.push(hr);

  // 2. الأكسجين
  const spo2 = assessVital('spo2', 'الأكسجين', reading.spo2 ?? null, baseline?.avgSpo2 ?? null, {
    criticalLow: thresholds.spo2CriticalLow,
    warningLow: thresholds.spo2WarningLow,
    std: baseline?.stdSpo2 ?? undefined,
  });
  vitals.push(spo2);

  // 3. التنفس
  const resp = assessVital('respiratoryRate', 'التنفس', reading.respiratoryRate ?? null, baseline?.avgRespiratoryRate ?? null, {
    criticalHigh: thresholds.respiratoryRateCriticalHigh,
    criticalLow: thresholds.respiratoryRateCriticalLow,
    warningHigh: thresholds.respiratoryRateWarningHigh,
    warningLow: thresholds.respiratoryRateWarningLow,
    std: baseline?.stdRespiratoryRate ?? undefined,
  });
  vitals.push(resp);

  // 4. HRV
  const hrv = assessVital('heartRateVariability', 'HRV', reading.heartRateVariability ?? null, baseline?.avgHrv ?? null, {
    criticalLow: thresholds.hrvCriticalLow,
    warningLow: thresholds.hrvWarningLow,
    std: baseline?.stdHrv ?? undefined,
  });
  vitals.push(hrv);

  // 5. الحرارة
  const temp = assessVital('bodyTemperature', 'الحرارة', reading.bodyTemperature ?? null, baseline?.avgTemperature ?? null, {
    criticalHigh: thresholds.temperatureCriticalHigh,
    criticalLow: thresholds.temperatureCriticalLow,
    warningHigh: thresholds.temperatureWarningHigh,
    warningLow: thresholds.temperatureWarningLow,
    std: baseline?.stdTemperature ?? undefined,
  });
  vitals.push(temp);

  // 6. التوتر
  const stress = assessVital('stressLevel', 'التوتر', reading.stressLevel ?? null, baseline?.avgStress ?? null, {
    criticalHigh: thresholds.stressCriticalHigh,
    warningHigh: thresholds.stressWarningHigh,
  });
  vitals.push(stress);

  // تحليل الحركة — نحتاج آخر وقت حركة من قاعدة البيانات
  const lastMovementRecord = await prisma.vitalSample.findFirst({
    where: { userId, movementMagnitude: { gt: 0.5 } },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  const movement = analyzeMovement(
    reading,
    lastMovementRecord?.timestamp ?? null,
    thresholds.noMovementDurationSec,
    thresholds.noMovementSwimDurationSec,
  );

  // حساب درجة الخطورة الشاملة (0-100)
  let riskScore = 0;
  const activeIndicators: string[] = [];

  for (const v of vitals) {
    if (v.severity === 'critical') { riskScore += 35; activeIndicators.push(v.indicator); }
    else if (v.severity === 'warning') { riskScore += 20; activeIndicators.push(v.indicator); }
    else if (v.severity === 'attention') { riskScore += 10; activeIndicators.push(v.indicator); }
  }

  // الحركة
  if (movement.riskContribution === 'critical') { riskScore += 40; activeIndicators.push('noMovement'); }
  else if (movement.riskContribution === 'warning') { riskScore += 25; activeIndicators.push('movementAnomaly'); }

  // تعظيم: مؤشرات متعددة في نفس الوقت
  const isMultiIndicator = activeIndicators.length >= 2;
  if (isMultiIndicator) riskScore = Math.min(100, riskScore * 1.3);

  // تعظيم أثناء السباحة
  if (reading.isSwimming && riskScore > 10) riskScore = Math.min(100, riskScore * 1.2);

  riskScore = Math.round(Math.min(100, Math.max(0, riskScore)));

  // تحديد المستوى الشامل
  let overallRisk: RiskLevel = 'normal';
  if (riskScore >= 60) overallRisk = 'critical';
  else if (riskScore >= 35) overallRisk = 'warning';
  else if (riskScore >= 15) overallRisk = 'attention';

  const swimSessionActive = reading.isSwimming || reading.workoutStatus === 'swimming';

  // تحديث خط الأساس (المؤشرات الطبيعية فقط)
  await updateBaseline(userId, {
    heartRate: reading.heartRate,
    spo2: reading.spo2,
    heartRateVariability: reading.heartRateVariability,
    respiratoryRate: reading.respiratoryRate,
    bodyTemperature: reading.bodyTemperature,
    stressLevel: reading.stressLevel,
    movementMagnitude: movement.movementMagnitude,
    workoutStatus: reading.workoutStatus,
  });

  let recommendedAction = 'مراقبة عادية';
  if (overallRisk === 'critical') recommendedAction = 'possible_emergency_detected';
  else if (overallRisk === 'warning') recommendedAction = 'check_swatch_immediately';
  else if (overallRisk === 'attention') recommendedAction = 'monitor_closely';

  return {
    overallRisk,
    riskScore,
    vitals,
    activeIndicators,
    isMovementAnomaly: movement.isNoMovement || movement.isFallDetected,
    isMultiIndicator,
    swimSessionActive,
    recommendedAction,
  };
}
