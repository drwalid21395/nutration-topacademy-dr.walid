/**
 * مولّد التقييم الشامل للمكملات — ينسّق كل الوحدات:
 * التغطية ← الأهلية ← البروتين ← الترطيب ← البدائل ← الجدول ← المستوى العام.
 * الغذاء الطبيعي في المرتبة الأولى دائمًا، والنتائج تقديرية وليست وصفات.
 */
import { SUPPLEMENT_PROFILES } from './profiles';
import { buildNutrientRow } from './coverage';
import { runEligibility, type EligibilityProfile } from './eligibility';
import { calculateProteinSupplementGap } from './protein';
import { calculateHydrationAndElectrolytes } from './hydration';
import { generateSupplementSchedule } from './schedule';
import { PROTEIN_FOOD_OPTIONS } from './protein';
import type {
  NutrientRow,
  SupplementAssessmentInput,
  SupplementAssessmentOutput,
  EligibilityContext,
} from './types';

export const ASSESSMENT_VERSION = '1.0';

/** ربط نتيجة تحليل مخبري منخفضة بمكمل (إن وجد) */
const LAB_TO_SUPPLEMENT: Record<string, string[]> = {
  ferritin: ['iron'],
  hemoglobin: ['iron'],
  iron: ['iron'],
  transferrin: ['iron'],
  vitaminD: ['vitamin-d'],
  b12: ['vitamin-b12'],
  folate: ['folate'],
  magnesium: ['magnesium'],
  calcium: ['calcium'],
  zinc: ['zinc'],
};

function daysAwayFrom(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

function buildEligibilityContext(input: SupplementAssessmentInput): EligibilityContext {
  return {
    isMinor: input.isMinor,
    guardianConsent: input.guardianConsent,
    age: input.age,
    gender: input.gender,
    chronicConditions: input.chronicConditions,
    medications: input.medications,
    allergies: input.allergies,
    digestiveIssues: input.digestiveIssues,
    pregnancyStatus: input.pregnancyStatus,
    hasEatingDisorderHistory: false,
    competitionMode: input.competitionMode,
    competitionDaysAway: daysAwayFrom(input.nextCompetitionDate),
    currentIngredients: input.products.flatMap((p) => p.ingredients),
    dietaryDeficitForTarget: false,
    hasRelevantLab: false,
  };
}

function labIsLow(input: SupplementAssessmentInput, marker: string): boolean {
  return input.labResults.some((r) => {
    if (r.marker !== marker) return false;
    const low = parseFloat(r.referenceRange?.split('-')[0] ?? '');
    if (isNaN(low) || !low) return false;
    return r.value < low;
  });
}

function triggerFor(input: SupplementAssessmentInput, profile: { key: string; trigger: string; targetNutrient: string }): boolean {
  if (profile.trigger === 'lab') {
    const markers = Object.entries(LAB_TO_SUPPLEMENT).find(([, keys]) => keys.includes(profile.key))?.[0];
    return !!markers && labIsLow(input, markers);
  }
  if (profile.trigger === 'training') {
    const intensity = input.trainingIntensity;
    const highLoad =
      (input.swimSessionsPerWeek ?? 0) >= 5 ||
      (input.swimMinutesPerSession ?? 0) >= 75 ||
      input.hasDoubleTraining;
    if (profile.key === 'caffeine') return highLoad || intensity === 'high' || intensity === 'veryHigh';
    if (profile.key === 'creatine' || profile.key === 'beta-alanine') {
      // سرعات/سباقات قصيرة
      return highLoad && input.goal === 'competition';
    }
    return highLoad;
  }
  if (profile.trigger === 'hydration') {
    return (input.trainingWaterMl ?? 0) > 500 || (input.swimMinutesPerSession ?? 0) >= 75;
  }
  if (profile.trigger === 'nutrient') {
    const coverageMap = buildCoverageRows(input);
    const row = coverageMap.find((r) => r.key === profile.targetNutrient);
    return !!row && row.deficit > 0;
  }
  return false;
}

/** صفوف التغطية من الأطعمة والسجلات مقابل الاحتياجات */
export function buildCoverageRows(input: SupplementAssessmentInput): NutrientRow[] {
  return [
    buildNutrientRow({
      key: 'calories', nameAr: 'السعرات', unit: 'سعرة', requirement: input.dailyCaloriesTarget ?? 0,
      fromFood: input.avgFoodCalories, fromSupplement: 0,
    }),
    buildNutrientRow({
      key: 'protein', nameAr: 'البروتين', unit: 'جم', requirement: input.proteinTarget ?? 0,
      fromFood: input.avgFoodProteinG, fromSupplement: 0, upperLimit: 3 * (input.weightKg ?? 70),
    }),
    buildNutrientRow({
      key: 'carbs', nameAr: 'الكربوهيدرات', unit: 'جم', requirement: input.carbsTarget ?? 0,
      fromFood: input.avgFoodCarbsG,
    }),
    buildNutrientRow({
      key: 'fat', nameAr: 'الدهون', unit: 'جم', requirement: input.fatTarget ?? 0,
      fromFood: input.avgFoodFatG,
    }),
    buildNutrientRow({
      key: 'fiber', nameAr: 'الألياف', unit: 'جم', requirement: input.fiberTarget ?? 0,
      fromFood: input.avgFoodFiberG,
    }),
    buildNutrientRow({
      key: 'sodium', nameAr: 'الصوديوم', unit: 'ملجم', requirement: input.sodiumTarget ?? 0,
      fromFood: input.avgFoodSodiumMg, upperLimit: 2300,
    }),
    buildNutrientRow({
      key: 'water', nameAr: 'الماء', unit: 'مل', requirement: input.waterTarget ?? 0,
      fromFood: input.avgWaterMl,
    }),
  ];
}

export function generateSupplementAssessment(input: SupplementAssessmentInput): SupplementAssessmentOutput {
  const coverage = buildCoverageRows(input);
  const ctx = buildEligibilityContext(input);

  const eligibility: SupplementAssessmentOutput['eligibility'] = [];
  const recommendations: SupplementAssessmentOutput['recommendations'] = [];
  const foodAlternatives: SupplementAssessmentOutput['foodAlternatives'] = [];
  let needsMedicalApproval = false;
  let needsGuardianConsent = input.isMinor && !input.guardianConsent;
  let needsLabTest = false;

  for (const profile of SUPPLEMENT_PROFILES) {
    const triggered = triggerFor(input, profile);
    if (!triggered) continue;

    // عجز حقيقي للعنصر المستهدف
    const targetRow = coverage.find((r) => r.key === profile.targetNutrient);
    const deficit = targetRow?.deficit ?? 0;
    const eligibilityCtx: EligibilityContext = {
      ...ctx,
      dietaryDeficitForTarget: deficit > 0 || profile.trigger !== 'nutrient',
      hasRelevantLab: profile.needsLabTest
        ? Object.entries(LAB_TO_SUPPLEMENT).some(([m, keys]) => keys.includes(profile.key) && labIsLow(input, m)) ||
          input.labResults.some((l) => Object.values(LAB_TO_SUPPLEMENT).flat().includes(profile.key) && l.marker === profile.key.replace('vitamin-d', 'vitaminD'))
        : false,
    };

    const res = runEligibility(profile as unknown as EligibilityProfile, eligibilityCtx);
    eligibility.push({ key: profile.key, nameAr: profile.nameAr, verdict: res.verdict, ok: res.ok, reasons: res.reasons });

    needsMedicalApproval = needsMedicalApproval || res.flags.needsDoctor;
    needsLabTest = needsLabTest || res.flags.needsLab;

    // توصية نهائية
    if (!res.ok) {
      recommendations.push({
        key: profile.key,
        nameAr: profile.nameAr,
        status: res.verdict === 'food-sufficient' ? 'food-first' : 'blocked',
        verdict: res.verdict,
        evidenceStrength: profile.evidenceStrength,
        coverageFromFoodPct: targetRow?.coverageFoodPct ?? 0,
        deficit,
        doseEstimate: null,
        doseUnit: profile.doseUnit,
        timingAr: profile.timingAr,
        durationDays: profile.durationDays,
        upperLimitWarning: null,
        medicalNote: res.reasons.join(' '),
      });
      continue;
    }

    const upperLimitWarning = profile.safeUpperLimit ? `الحد الأعلى الآمن: ${profile.safeUpperLimit} ${profile.doseUnit}/يوم.` : null;

    recommendations.push({
      key: profile.key,
      nameAr: profile.nameAr,
      status: 'needs-review',
      verdict: res.verdict,
      evidenceStrength: profile.evidenceStrength,
      coverageFromFoodPct: targetRow?.coverageFoodPct ?? 0,
      deficit,
      doseEstimate: profile.doseUnit === 'g' || profile.doseUnit === 'mg' || profile.doseUnit === 'mcg' || profile.doseUnit === 'IU' ? profile.minDose : null,
      doseUnit: profile.doseUnit,
      timingAr: profile.timingAr,
      durationDays: profile.durationDays,
      upperLimitWarning,
      medicalNote: profile.needsMedicalSupervision
        ? 'إشراف مختص مطلوب قبل بدء الاستخدام — النتيجة استرشادية وليست وصفة.'
        : 'نتيجة محسوبة آليًا — تُعتمد من المختص قبل الاستخدام.',
    });
  }

  // البروتين
  const proteinGap =
    input.proteinTarget && input.proteinTarget > 0
      ? calculateProteinSupplementGap({ requirementG: input.proteinTarget, fromFoodG: input.avgFoodProteinG })
      : null;

  // قصر بروتيني: الغذاء أولًا — إذا كان العجز قابلًا للتغطية غذائيًا فلا تُقدَّر جرعة المسحوق
  if (proteinGap && proteinGap.deficitG > 0 && proteinGap.gapCoverableByFood) {
    const whey = recommendations.find((r) => r.key === 'whey');
    if (whey) {
      whey.status = 'food-first';
      whey.doseEstimate = null;
      whey.medicalNote = 'يمكن تغطية العجز من الطعام الطبيعي أولًا — لا يُقترح مكمل بروتيني الآن.';
    }
  }

  // بدائل غذائية للعناصر الناقصة
  const proteinRow = coverage.find((r) => r.key === 'protein');
  if (proteinRow && proteinRow.deficit > 0) {
    let remaining = proteinRow.deficit;
    const options: { nameAr: string; grams: number; proteinG: number; calories: number }[] = [];
    for (const opt of PROTEIN_FOOD_OPTIONS) {
      if (remaining <= 0) break;
      const take = Math.min(opt.proteinG, remaining);
      options.push({ nameAr: opt.nameAr, grams: Math.round(opt.grams * (take / opt.proteinG)), proteinG: Math.round(take), calories: Math.round(opt.calories * (take / opt.proteinG)) });
      remaining = Math.round((remaining - take) * 10) / 10;
    }
    foodAlternatives.push({ key: 'protein', nameAr: 'البروتين', options });
  }

  // الترطيب
  const hydration =
    input.weightKg && input.swimMinutesPerSession
      ? calculateHydrationAndElectrolytes({
          bodyWeightKg: input.weightKg,
          swimMinutes: input.swimMinutesPerSession,
          sessionsPerDay: input.hasDoubleTraining ? 2 : 1,
          intensity: input.trainingIntensity,
          sodiumFromFoodMg: input.avgFoodSodiumMg,
          targetWaterMl: input.waterTarget ?? 0,
          trainingWaterMl: input.trainingWaterMl ?? 0,
        })
      : null;

  // الجدول
  const schedule = generateSupplementSchedule({
    recommendations: recommendations
      .filter((r) => r.status === 'needs-review')
      .map((r) => ({ key: r.key, nameAr: r.nameAr, dose: r.doseEstimate ? `${r.doseEstimate} ${r.doseUnit}` : '—', withFood: true, timingAr: r.timingAr, durationDays: r.durationDays })),
  });

  // المستوى العام
  const suggested = recommendations.filter((r) => r.status === 'needs-review');
  const blockedForHealth = eligibility.some((e) => ['health-blocked', 'drug-interaction', 'age-blocked', 'doping-blocked', 'competition-blocked'].includes(e.verdict));
  let overallLevel: SupplementAssessmentOutput['overallLevel'] = 'none';
  if (needsMedicalApproval && suggested.length > 0) overallLevel = 'specialist';
  else if (suggested.length > 0) overallLevel = 'medium';
  else if (blockedForHealth) overallLevel = 'low';
  else if (eligibility.some((e) => e.verdict === 'needs-lab')) overallLevel = 'low';

  const summary = suggested.length > 0
    ? 'توجد عناصر قابلة للدراسة بعد استيفاء شروط الأهلية — جميع الجرعات استرشادية وتتطلب مراجعة مختص (خصوصًا للقاصرين ومستخدمي الأدوية وأصحاب الحالات المزمنة).'
    : 'لا توجد حاجة حالية إلى مكمل غذائي واضح، ويمكن تغطية الاحتياجات من النظام الغذائي أولًا، مع إعادة التقييم عند تغير الوزن أو التدريب أو التحاليل.';

  return {
    version: ASSESSMENT_VERSION,
    overallLevel,
    needsMedicalApproval,
    needsGuardianConsent,
    needsLabTest,
    coverage,
    eligibility,
    proteinGap,
    hydration,
    recommendations,
    schedule,
    foodAlternatives,
    summary,
  };
}
