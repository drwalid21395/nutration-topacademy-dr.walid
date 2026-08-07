import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { summarizeNutrition } from '@/services/nutrition';
import { rateLimit, audit } from '@/lib/security';

/**
 * POST: حساب الاحتياجات من ملف السباح المحفوظ (أو من بيانات مرسلة).
 * يحفظ النتائج في NutritionTargets ويعيد الملخص كاملًا.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`calc:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: 'أدخل بيانات السباح أولًا' }, { status: 422 });
  }

  const required = [profile.gender, profile.age, profile.heightCm, profile.weightKg];
  if (required.some((v) => v === null || v === undefined)) {
    return NextResponse.json(
      { error: 'أكمل البيانات الأساسية: الجنس والعمر والطول والوزن' },
      { status: 422 }
    );
  }

  const summary = summarizeNutrition({
    gender: profile.gender,
    age: profile.age ?? 17,
    heightCm: profile.heightCm ?? 170,
    weightKg: profile.weightKg ?? 60,
    bodyFatPercent: profile.bodyFatPercent ?? undefined,
    goal: profile.goal ?? undefined,
    swimmerLevel: profile.swimmerLevel ?? undefined,
    swimSessionsPerWeek: profile.swimSessionsPerWeek ?? undefined,
    swimMinutesPerSession: profile.swimMinutesPerSession ?? undefined,
    trainingIntensity: profile.trainingIntensity ?? undefined,
    gymSessionsPerWeek: profile.gymSessionsPerWeek ?? undefined,
    gymMinutesPerSession: profile.gymMinutesPerSession ?? undefined,
    gymType: profile.gymType ?? undefined,
    dailyActivityLevel: profile.dailyActivityLevel ?? undefined,
    preferredMealsPerDay: profile.preferredMealsPerDay ?? undefined,
    isMinor: profile.isMinor,
    hasDoubleTraining: profile.hasDoubleTraining,
    nextCompetitionDate: profile.nextCompetitionDate ?? null,
    chronicConditions: profile.chronicConditions ?? undefined,
    allergies: profile.allergies ?? undefined,
    pregnancyStatus: profile.pregnancyStatus ?? undefined,
  });

  const targets = await prisma.nutritionTargets.create({
    data: {
      profileId: profile.id,
      bmi: summary.result.bmi,
      bmiCategory: summary.result.bmiCategory,
      bmr: summary.result.bmr,
      tdee: summary.result.tdee,
      calories: summary.result.calories,
      calorieMin: summary.result.calorieMin,
      calorieMax: summary.result.calorieMax,
      proteinG: summary.result.proteinG,
      carbsG: summary.result.carbsG,
      fatG: summary.result.fatG,
      fiberG: summary.result.fiberG,
      waterMl: summary.result.waterMl,
      trainingWaterMl: summary.result.trainingWaterMl,
      sodiumMg: summary.result.sodiumMg,
      proteinPct: summary.result.proteinPct,
      carbsPct: summary.result.carbsPct,
      fatPct: summary.result.fatPct,
      mealCalories: JSON.stringify(summary.result.mealCalories ?? {}),
      trainingCalories: JSON.stringify(summary.result.trainingCalories ?? {}),
      formula: summary.result.formula,
      recommendations: JSON.stringify(summary.recommendations ?? {}),
    },
  });

  await audit(user.id, 'nutrition.calculate', 'NutritionTargets', targets.id);

  return NextResponse.json({
    ok: true,
    targetsId: targets.id,
    result: summary.result,
    recommendations: summary.recommendations,
    alerts: summary.alerts,
  });
}
