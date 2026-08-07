/**
 * حساب الترطيب والإلكتروليتات المرتبط بالتدريب:
 * تغير الوزن، معدل التعرق، السوائل أثناء/بعد التدريب، واحتياج الإلكتروليت.
 * تحذير: لا تُقدَّم توصيات صوديوم للمرضى/الحالات الخاصة دون مراجعة طبية.
 */
import type { HydrationResult } from './types';

export interface HydrationInput {
  bodyWeightKg: number;
  weightBeforeKg?: number | null;
  weightAfterKg?: number | null;
  fluidConsumedMl?: number | null;
  swimMinutes: number;
  sessionsPerDay: number;
  intensity: string | null;
  temperatureC?: number | null;
  humidityPct?: number | null;
  sodiumFromFoodMg: number;
  targetWaterMl: number;
  trainingWaterMl: number;
}

export function calculateHydrationAndElectrolytes(input: HydrationInput): HydrationResult {
  const warnings: string[] = [];

  // تغير الوزن أثناء التدريب (إذا توفرت البيانات)
  let weightLossKg = 0;
  let weightLossPct = 0;
  let sweatRateLh = 0;
  if (input.weightBeforeKg != null && input.weightAfterKg != null) {
    weightLossKg = Math.max(input.weightBeforeKg - input.weightAfterKg, 0);
    weightLossPct = input.weightBeforeKg > 0 ? (weightLossKg / input.weightBeforeKg) * 100 : 0;
    const minutes = Math.max(input.swimMinutes, 1);
    // تعويض السوائل المستهلكة أثناء الجلسة
    const fluidKg = ((input.fluidConsumedMl ?? 0) / 1000);
    const sweatKg = weightLossKg + fluidKg;
    sweatRateLh = (sweatKg / minutes) * 60;
    if (weightLossPct > 2) {
      warnings.push(`فقدان وزن ${weightLossPct.toFixed(1)}٪ أثناء التدريب (> 2٪) — يزيد خطر هبوط الأداء والجفاف.`);
    }
  }

  const minutes = Math.max(input.swimMinutes, 1);
  const intensityFactor =
    input.intensity === 'veryHigh' ? 1.25 : input.intensity === 'high' ? 1.0 : input.intensity === 'moderate' ? 0.85 : 0.7;
  const heatFactor = ((input.temperatureC ?? 22) - 22) * 0.02 + ((input.humidityPct ?? 50) - 50) * 0.004;
  const baseSweatLh = 0.75 + (input.bodyWeightKg / 100) * 0.45;
  const sweatEst = baseSweatLh * intensityFactor * Math.max(1 + heatFactor, 0.7);

  const fluidsDuringMl = Math.round(sweatEst * 1000 * Math.min(minutes / 60, 1.5) * 0.8);
  const fluidsAfterMl = Math.round(weightLossKg * 1000 * 1.5); // 150% من خسارة الوزن

  // حاجة إلكتروليت: جلسات طويلة + تعرق غزير
  const heat = (input.temperatureC ?? 22) >= 28 || (input.humidityPct ?? 50) >= 70;
  const longSession = minutes >= 75;
  const heavySweat = sweatRateLh > 0 ? sweatRateLh >= 1.2 : false;
  const electrolytesRecommended = longSession || heat || heavySweat;

  const sodiumFromFoodMg = Math.max(input.sodiumFromFoodMg, 0);
  const sodiumNeedMg = Math.round((sodiumFromFoodMg / 1000) * 1000 * 0.5); // إرشاد استرشادي فقط

  if (electrolytesRecommended && input.bodyWeightKg > 0) {
    if (sodiumFromFoodMg < input.targetWaterMl / 1000 * 500) {
      warnings.push('تعرّق غزير محتمل: قد تحتاج تعويض إلكتروليت — لاحظ أن توصيات الصوديوم محظورة للمرضى وأصحاب الضغط دون مراجعة طبية.');
    }
  }

  // منع الإفراط
  if ((input.fluidConsumedMl ?? 0) > 3000) {
    warnings.push('لا تفرط في الماء أثناء جلسة واحدة — الإفراط قد يسبب نقص صوديوم الدم.');
  }

  return {
    weightLossKg: Math.round(weightLossKg * 100) / 100,
    weightLossPct: Math.round(weightLossPct * 100) / 100,
    sweatRateLh: sweatRateLh > 0 ? Math.round(sweatRateLh * 100) / 100 : Math.round(sweatEst * 100) / 100,
    fluidsDuringMl,
    fluidsAfterMl,
    electrolytesRecommended,
    sodiumFromFoodMg,
    warnings,
  };
}
