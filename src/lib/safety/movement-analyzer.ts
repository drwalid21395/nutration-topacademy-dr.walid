// محلل الحركة — Movement Analyzer
// يكتشف فقدان الحركة والسقوط والحركات المفاجئة أثناء السباحة

import type { VitalReading, RiskLevel } from './types';

export interface MovementAnalysis {
  movementMagnitude: number;
  isNoMovement: boolean;
  isFallDetected: boolean;
  isSuddenMovement: boolean;
  noMovementDurationSec: number;
  riskContribution: RiskLevel;
  description: string;
}

// حساب مقدار الحركة من أوساط التسارع (ACR — Average Current Rate)
function calcMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

// تحليل الحركة من عيّنة قياس حديثة
export function analyzeMovement(
  reading: VitalReading,
  lastMovementTime: Date | null,
  noMovementThresholdSec: number,
  swimNoMovementThresholdSec: number,
): MovementAnalysis {
  const magnitude = reading.movementMagnitude
    ?? (reading.accelerometerX != null && reading.accelerometerY != null && reading.accelerometerZ != null
      ? calcMagnitude(reading.accelerometerX, reading.accelerometerY, reading.accelerometerZ)
      : 0);

  const now = new Date(reading.timestamp).getTime();
  const lastMovement = lastMovementTime?.getTime() ?? now;
  const noMovementSec = Math.max(0, (now - lastMovement) / 1000);

  const isSwimming = reading.isSwimming ?? false;
  const threshold = isSwimming ? swimNoMovementThresholdSec : noMovementThresholdSec;
  const isNoMovement = noMovementSec >= threshold;

  // اكتشاف السقوط: تسارع شديد مفاجئ followed by توقف
  const isFallDetected = magnitude > 50 && isSwimming;

  // حركة مفاجئة: تغير كبير في مقدار الحركة
  const isSuddenMovement = magnitude > 30;

  let riskContribution: RiskLevel = 'normal';
  let description = '';

  if (isNoMovement && isSwimming) {
    riskContribution = 'critical';
    description = `توقف الحركة أثناء السباحة منذ ${Math.round(noMovementSec)} ثانية`;
  } else if (isNoMovement) {
    riskContribution = 'warning';
    description = `توقف الحركة منذ ${Math.round(noMovementSec)} ثانية`;
  } else if (isFallDetected) {
    riskContribution = 'warning';
    description = `حركة سقوط محتملة (مقدار الحركة: ${Math.round(magnitude)})`;
  } else if (magnitude > 0.5) {
    riskContribution = 'normal';
    description = `حركة طبيعية (مقدار: ${Math.round(magnitude * 100) / 100})`;
  } else {
    description = `حركة منخفضة (مقدار: ${Math.round(magnitude * 100) / 100})`;
  }

  return {
    movementMagnitude: magnitude,
    isNoMovement,
    isFallDetected,
    isSuddenMovement,
    noMovementDurationSec: noMovementSec,
    riskContribution,
    description,
  };
}
