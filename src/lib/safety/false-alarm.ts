// حماية الإنذارات الكاذبة — False Alarm Protection
// يمنع إطلاق إنذارات طوارئ بناءً على قراءة منفردة غير موثوقة

import { prisma } from '@/lib/prisma';
import type { RiskLevel } from './types';

interface FalseAlarmCheck {
  shouldProceed: boolean;
  reason: string;
  adjustedSeverity: RiskLevel;
}

// التحقق: هل هذه القراءة كافية لإطلاق إنذار؟
export async function checkFalseAlarmProtection(
  userId: string,
  currentSeverity: RiskLevel,
  riskScore: number,
): Promise<FalseAlarmCheck> {
  // الإنذارات العادية لا تحتاج حماية
  if (currentSeverity === 'normal' || currentSeverity === 'attention') {
    return { shouldProceed: true, reason: 'level_too_low', adjustedSeverity: currentSeverity };
  }

  // جلب آخر 5 قراءات لنفس المستخدم
  const recentSamples = await prisma.vitalSample.findMany({
    where: { userId, timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });

  // لا نملك ما يكفي من البيانات — نخفض الخطورة مؤقتًا
  if (recentSamples.length < 2) {
    if (currentSeverity === 'critical') {
      return { shouldProceed: false, reason: 'insufficient_samples', adjustedSeverity: 'warning' };
    }
    return { shouldProceed: true, reason: 'warning_with_few_samples', adjustedSeverity: currentSeverity };
  }

  // التحقق من جودة الإشارة
  const poorQualitySamples = recentSamples.filter((s) => s.signalQuality === 'poor').length;
  if (poorQualitySamples >= recentSamples.length / 2) {
    if (currentSeverity === 'critical') {
      return { shouldProceed: false, reason: 'poor_signal_quality', adjustedSeverity: 'warning' };
    }
    return { shouldProceed: true, reason: 'low_quality_warning', adjustedSeverity: currentSeverity };
  }

  // التحقق من الاستمرارية: هل المؤشر الخطير مستمر في أكثر من قراءة؟
  if (currentSeverity === 'critical') {
    // نتحقق من آخر 3 قراءات: يجب أن يكون至少 2 منها حرجة
    const criticalCount = recentSamples.filter((s) => {
      // نعتبر قراءة حرجة إذا كان النبض < 40 أو > 200 أو الأكسجين < 88
      return (s.heartRate != null && (s.heartRate < 40 || s.heartRate > 200))
        || (s.spo2 != null && s.spo2 < 88)
        || (s.bodyTemperature != null && (s.bodyTemperature < 35 || s.bodyTemperature > 39.5));
    }).length;

    if (criticalCount < 2) {
      return { shouldProceed: false, reason: 'single_critical_reading', adjustedSeverity: 'warning' };
    }

    // التحقق من تعدد المؤشرات
    const hasAbnormalHR = recentSamples.some((s) => s.heartRate != null && (s.heartRate < 45 || s.heartRate > 190));
    const hasAbnormalSpO2 = recentSamples.some((s) => s.spo2 != null && s.spo2 < 90);
    const hasNoMovement = recentSamples.every((s) => (s.movementMagnitude ?? 0) < 0.5);

    // إنذار طوارئ حقيقي: مؤشرات متعددة مستمرة
    if ((hasAbnormalHR && hasAbnormalSpO2) || (hasAbnormalHR && hasNoMovement) || (hasAbnormalSpO2 && hasNoMovement)) {
      return { shouldProceed: true, reason: 'confirmed_multi_indicator', adjustedSeverity: 'critical' };
    }

    // مؤشر واحد فقط — نخفض إلى تحذير
    return { shouldProceed: false, reason: 'single_indicator', adjustedSeverity: 'warning' };
  }

  // Warning level: نتحقق من الاستمرارية (至少 2 ق reading في آخر دقيقة)
  const warningCount = recentSamples.filter((s) => {
    return (s.heartRate != null && (s.heartRate < 50 || s.heartRate > 180))
      || (s.spo2 != null && s.spo2 < 92)
      || (s.respiratoryRate != null && (s.respiratoryRate < 10 || s.respiratoryRate > 25));
  }).length;

  if (warningCount < 2) {
    return { shouldProceed: false, reason: 'transient_warning', adjustedSeverity: 'attention' };
  }

  return { shouldProceed: true, reason: 'confirmed_warning', adjustedSeverity: 'warning' };
}

// التحقق من فترة الهدوء (cooldown) — لا نكرر الإنذار خلال X دقائق
export async function isInCooldown(userId: string, cooldownMinutes: number): Promise<boolean> {
  const lastAlert = await prisma.safetyAlert.findFirst({
    where: { userId, level: { in: ['warning', 'critical'] } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!lastAlert) return false;
  const elapsed = (Date.now() - lastAlert.createdAt.getTime()) / (60 * 1000);
  return elapsed < cooldownMinutes;
}
