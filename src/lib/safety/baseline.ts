// محرك خط الأساس الديناميكي — Dynamic Baseline Engine
// يتعلم تدريجيًا القيم الطبيعية لكل سباح ويكتشف الانحرافات

import { prisma } from '@/lib/prisma';
import type { BaselineData } from './types';

// تحديث خط الأساس بعيّنة قياس جديدة (المتوسط المتحرّك الأُسّي)
export async function updateBaseline(userId: string, reading: {
  heartRate?: number | null;
  spo2?: number | null;
  heartRateVariability?: number | null;
  respiratoryRate?: number | null;
  bodyTemperature?: number | null;
  stressLevel?: number | null;
  movementMagnitude?: number | null;
  workoutStatus?: string | null;
}): Promise<void> {
  const existing = await prisma.swimmerBaseline.findUnique({ where: { userId } });
  const alpha = 0.05; // معامل التحديث (0.05 = تحديث بطيء ومستقر)
  const isResting = reading.workoutStatus === 'resting' || reading.workoutStatus === null;

  const update: Record<string, unknown> = { sampleCount: { increment: 1 }, lastUpdated: new Date() };

  // نبض الراحة فقط during rest
  if (reading.heartRate && isResting) {
    if (existing?.avgHeartRate != null) {
      update.avgHeartRate = existing.avgHeartRate * (1 - alpha) + reading.heartRate * alpha;
      const diff = reading.heartRate - (existing.avgHeartRate as number);
      update.stdHeartRate = Math.sqrt(
        ((existing.stdHeartRate ?? 0) ** 2) * (1 - alpha) + diff * diff * alpha
      );
    } else {
      update.avgHeartRate = reading.heartRate;
      update.stdHeartRate = 5;
    }
  }

  // أكسجين الدم
  if (reading.spo2 != null) {
    if (existing?.avgSpo2 != null) {
      update.avgSpo2 = existing.avgSpo2 * (1 - alpha) + reading.spo2 * alpha;
      const diff = reading.spo2 - (existing.avgSpo2 as number);
      update.stdSpo2 = Math.sqrt(((existing.stdSpo2 ?? 2) ** 2) * (1 - alpha) + diff * diff * alpha);
    } else if (reading.spo2 > 90) { // نتجاهل قراءات منخفضة جدًا من التحديث
      update.avgSpo2 = reading.spo2;
      update.stdSpo2 = 2;
    }
  }

  // HRV
  if (reading.heartRateVariability != null) {
    if (existing?.avgHrv != null) {
      update.avgHrv = existing.avgHrv * (1 - alpha) + reading.heartRateVariability * alpha;
      const diff = reading.heartRateVariability - (existing.avgHrv as number);
      update.stdHrv = Math.sqrt(((existing.stdHrv ?? 10) ** 2) * (1 - alpha) + diff * diff * alpha);
    } else {
      update.avgHrv = reading.heartRateVariability;
      update.stdHrv = 10;
    }
  }

  // معدل التنفس
  if (reading.respiratoryRate != null) {
    if (existing?.avgRespiratoryRate != null) {
      update.avgRespiratoryRate = existing.avgRespiratoryRate * (1 - alpha) + reading.respiratoryRate * alpha;
      const diff = reading.respiratoryRate - (existing.avgRespiratoryRate as number);
      update.stdRespiratoryRate = Math.sqrt(((existing.stdRespiratoryRate ?? 2) ** 2) * (1 - alpha) + diff * diff * alpha);
    } else {
      update.avgRespiratoryRate = reading.respiratoryRate;
      update.stdRespiratoryRate = 2;
    }
  }

  // الحرارة
  if (reading.bodyTemperature != null && reading.bodyTemperature > 35 && reading.bodyTemperature < 42) {
    if (existing?.avgTemperature != null) {
      update.avgTemperature = existing.avgTemperature * (1 - alpha) + reading.bodyTemperature * alpha;
      const diff = reading.bodyTemperature - (existing.avgTemperature as number);
      update.stdTemperature = Math.sqrt(((existing.stdTemperature ?? 0.3) ** 2) * (1 - alpha) + diff * diff * alpha);
    } else {
      update.avgTemperature = reading.bodyTemperature;
      update.stdTemperature = 0.3;
    }
  }

  // التوتر
  if (reading.stressLevel != null) {
    if (existing?.avgStress != null) {
      update.avgStress = existing.avgStress * (1 - alpha) + reading.stressLevel * alpha;
    } else {
      update.avgStress = reading.stressLevel;
    }
  }

  // مقدار الحركة
  if (reading.movementMagnitude != null) {
    if (existing?.avgMovement != null) {
      update.avgMovement = existing.avgMovement * (1 - alpha) + reading.movementMagnitude * alpha;
    } else {
      update.avgMovement = reading.movementMagnitude;
    }
  }

  if (existing) {
    await prisma.swimmerBaseline.update({ where: { userId }, data: update });
  } else {
    await prisma.swimmerBaseline.create({ data: { userId, ...update } });
  }
}

// جلب خط الأساس الحالي للسبّاح
export async function getBaseline(userId: string): Promise<BaselineData | null> {
  const b = await prisma.swimmerBaseline.findUnique({ where: { userId } });
  if (!b) return null;
  return {
    avgHeartRate: b.avgHeartRate,
    stdHeartRate: b.stdHeartRate,
    avgSpo2: b.avgSpo2,
    stdSpo2: b.stdSpo2,
    avgHrv: b.avgHrv,
    stdHrv: b.stdHrv,
    avgRespiratoryRate: b.avgRespiratoryRate,
    stdRespiratoryRate: b.stdRespiratoryRate,
    avgTemperature: b.avgTemperature,
    stdTemperature: b.stdTemperature,
    avgStress: b.avgStress,
    avgMovement: b.avgMovement,
    stdMovement: b.stdMovement,
    sampleCount: b.sampleCount,
  };
}
