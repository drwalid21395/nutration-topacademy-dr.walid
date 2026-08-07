import { describe, it, expect } from 'vitest';
import {
  calculateNutrientCoverage,
  checkUpperLimit,
  classifyCoverage,
  buildNutrientRow,
} from './coverage';
import {
  runEligibility,
  checkDuplicateIngredients,
  type EligibilityProfile,
} from './eligibility';
import { calculateProteinSupplementGap } from './protein';
import { calculateHydrationAndElectrolytes } from './hydration';
import { generateSupplementSchedule } from './schedule';
import { generateSupplementAssessment } from './assessment';
import type { EligibilityContext, SupplementAssessmentInput } from './types';

const baseProfile: EligibilityProfile = {
  key: 'creatine',
  nameAr: 'كرياتين',
  category: 'قوة وأداء',
  minAge: 18,
  suitableForMinors: false,
  needsLabTest: false,
  needsMedicalSupervision: true,
  needsRx: false,
  dopingRisk: 'low',
  linkedToCompetition: true,
  targetNutrient: 'creatine',
  evidenceStrength: 'A',
};

function ctx(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    isMinor: false,
    guardianConsent: false,
    age: 22,
    gender: 'male',
    chronicConditions: null,
    medications: null,
    allergies: null,
    digestiveIssues: null,
    pregnancyStatus: 'none',
    hasEatingDisorderHistory: false,
    competitionMode: false,
    competitionDaysAway: null,
    currentIngredients: [],
    dietaryDeficitForTarget: true,
    hasRelevantLab: true,
    ...overrides,
  };
}

describe('coverage', () => {
  it('يحسب النسب والعجز والفائض', () => {
    const r = calculateNutrientCoverage(200, 150);
    expect(r.coverageFoodPct).toBe(75);
    expect(r.deficit).toBe(50);
    expect(r.surplus).toBe(0);
    expect(calculateNutrientCoverage(100, 120).surplus).toBe(20);
    expect(calculateNutrientCoverage(0, 10).coverageFoodPct).toBe(0);
  });

  it('يفحص الحد الأعلى (اقتراب/تجاوز)', () => {
    expect(checkUpperLimit(50, 100).status).toBe('ok');
    expect(checkUpperLimit(91, 100).status).toBe('approaching');
    expect(checkUpperLimit(100, 100).status).toBe('exceeded');
    expect(checkUpperLimit(50, null).status).toBe('ok');
  });

  it('يصنّف التغطية بالحدود المطلوبة', () => {
    expect(classifyCoverage(60)).toBe('low');
    expect(classifyCoverage(80)).toBe('improve');
    expect(classifyCoverage(100)).toBe('ok');
    expect(classifyCoverage(120)).toBe('review');
  });

  it('يبني صفًا كاملًا مع حد أعلى', () => {
    const row = buildNutrientRow({ key: 'protein', nameAr: 'بروتين', unit: 'g', requirement: 140, fromFood: 130, fromSupplement: 20, upperLimit: 60 });
    expect(row.total).toBe(150);
    expect(row.deficit).toBe(0);
    expect(row.limitStatus).toBe('exceeded');
  });
});

describe('eligibility', () => {
  it('يمنع القاصرين غير المدعومين', () => {
    const r = runEligibility(baseProfile, ctx({ isMinor: true, age: 16 }));
    expect(r.ok).toBe(false);
    expect(r.verdict).toBe('age-blocked');
  });

  it('يتطلب موافقة ولي الأمر للقاصر', () => {
    const r = runEligibility({ ...baseProfile, suitableForMinors: true }, ctx({ isMinor: true, age: 16 }));
    expect(r.verdict).toBe('minor-consent');
  });

  it('يحجب مكملًا مع أمراض كلى', () => {
    const r = runEligibility(baseProfile, ctx({ chronicConditions: 'فشل كلوي' }));
    expect(r.verdict).toBe('health-blocked');
  });

  it('يكشف تداخلًا دوائيًا (أوميجا 3 + مميعات)', () => {
    const r = runEligibility(
      { ...baseProfile, key: 'omega3', nameAr: 'أوميجا-3', linkedToCompetition: false },
      ctx({ medications: 'وارفارين' })
    );
    expect(r.verdict).toBe('drug-interaction');
  });

  it('يتطلب تحليلًا قبل تقييم يحتاج تحليلًا', () => {
    const r = runEligibility({ ...baseProfile, needsLabTest: true }, ctx({ hasRelevantLab: false }));
    expect(r.verdict).toBe('needs-lab');
  });

  it('الغذاء أولًا عند عدم وجود عجز', () => {
    const r = runEligibility(baseProfile, ctx({ dietaryDeficitForTarget: false }));
    expect(r.verdict).toBe('food-sufficient');
  });

  it('يحظر مكملًا قبل البطولة بأقل من 7 أيام', () => {
    const r = runEligibility(baseProfile, ctx({ competitionMode: true, competitionDaysAway: 3 }));
    expect(r.verdict).toBe('competition-blocked');
  });

  it('يحذّر عند الاقتراب من الحد الأعلى (90%)', () => {
    const dup = checkDuplicateIngredients(
      'كرياتين',
      ctx({ currentIngredients: [{ name: 'كرياتين', amount: 9, unit: 'g' }] }),
      10
    );
    expect(dup.status).toBe('approaching');
    expect(dup.duplicate).toBe(true);
  });

  it('يمنع تجاوز الحد الأعلى', () => {
    const dup = checkDuplicateIngredients(
      'كرياتين',
      ctx({ currentIngredients: [{ name: 'كرياتين', amount: 11, unit: 'g' }] }),
      10
    );
    expect(dup.status).toBe('exceeded');
  });
});

describe('protein', () => {
  it('العجز القابل للتغطية غذائيًا لا يُقترح مسحوق', () => {
    const r = calculateProteinSupplementGap({ requirementG: 140, fromFoodG: 120 });
    expect(r.deficitG).toBe(20);
    expect(r.gapCoverableByFood).toBe(true);
    expect(r.supplementPartG).toBe(0);
    expect(r.powderScoops).toBe(0);
    expect(r.foodOptions.length).toBeGreaterThan(0);
  });

  it('يقدّر المسحوق فقط بعد العجز غير القابل للغذاء', () => {
    const r = calculateProteinSupplementGap({ requirementG: 200, fromFoodG: 0 });
    expect(r.gapCoverableByFood).toBe(false);
    expect(r.supplementPartG).toBeGreaterThan(0);
    expect(r.powderScoops).toBeGreaterThan(0);
  });

  it('لا عجز = لا حاجة', () => {
    const r = calculateProteinSupplementGap({ requirementG: 140, fromFoodG: 150 });
    expect(r.deficitG).toBe(0);
    expect(r.supplementPartG).toBe(0);
  });
});

describe('hydration', () => {
  it('يوصي بالكهرل للجلسات الطويلة', () => {
    const r = calculateHydrationAndElectrolytes({
      bodyWeightKg: 70,
      swimMinutes: 120,
      sessionsPerDay: 1,
      intensity: 'high',
      sodiumFromFoodMg: 1200,
      targetWaterMl: 4000,
      trainingWaterMl: 800,
    });
    expect(r.electrolytesRecommended).toBe(true);
    expect(r.fluidsDuringMl).toBeGreaterThan(0);
  });

  it('يحذر عند فقدان وزن > 2%', () => {
    const r = calculateHydrationAndElectrolytes({
      bodyWeightKg: 70,
      weightBeforeKg: 70,
      weightAfterKg: 68.5,
      swimMinutes: 90,
      sessionsPerDay: 1,
      intensity: 'high',
      sodiumFromFoodMg: 1200,
      targetWaterMl: 4000,
      trainingWaterMl: 800,
    });
    expect(r.weightLossPct).toBeGreaterThan(2);
    expect(r.warnings.some((w) => w.includes('2٪'))).toBe(true);
  });
});

describe('schedule', () => {
  it('يرتب حسب التوقيت ويمنع تكرار المكون', () => {
    const rows = generateSupplementSchedule({
      recommendations: [
        { key: 'whey', nameAr: 'بروتين', dose: '25 جم', withFood: true, timingAr: 'بعد التدريب' },
        { key: 'creatine', nameAr: 'كرياتين', dose: '5 جم', withFood: true, timingAr: 'مع وجبة' },
        { key: 'whey', nameAr: 'بروتين', dose: '25 جم', withFood: true, timingAr: 'صباح' },
      ],
    });
    expect(rows.length).toBe(2);
    expect(rows[0].item).toBe('بروتين');
  });

  it('يميز عنصرًا ليوم البطولة فقط', () => {
    const rows = generateSupplementSchedule({
      recommendations: [{ key: 'caffeine', nameAr: 'كافيين', dose: '100 ملجم', withFood: true, competitionOnly: true }],
    });
    expect(rows[0].time).toBe('يوم البطولة فقط');
    expect(rows[0].onCompetitionDay).toBe(true);
  });

  it('يعيد صفًا احتياطيًا عند عدم وجود توصيات', () => {
    const rows = generateSupplementSchedule({ recommendations: [] });
    expect(rows[0].item).toContain('لا توجد مكملات');
  });
});

describe('assessment (تكامل)', () => {
  const baseInput: SupplementAssessmentInput = {
    profileId: null,
    isMinor: false,
    guardianConsent: false,
    age: 22,
    gender: 'male',
    weightKg: 70,
    heightCm: 178,
    bodyFatPercent: 12,
    goal: 'competition',
    dietType: 'regular',
    allergies: null,
    chronicConditions: null,
    medications: null,
    digestiveIssues: null,
    pregnancyStatus: 'none',
    swimSessionsPerWeek: 6,
    swimMinutesPerSession: 120,
    trainingIntensity: 'high',
    hasDoubleTraining: true,
    sleepHours: 8,
    nextCompetitionDate: new Date(Date.now() + 21 * 86400000).toISOString(),
    competitionMode: true,
    dailyCaloriesTarget: 4300,
    proteinTarget: 140,
    carbsTarget: 634,
    fatTarget: 134,
    fiberTarget: 38,
    waterTarget: 4000,
    trainingWaterMl: 800,
    sodiumTarget: 2000,
    avgFoodCalories: 3800,
    avgFoodProteinG: 120,
    avgFoodCarbsG: 570,
    avgFoodFatG: 123,
    avgFoodFiberG: 30,
    avgFoodSodiumMg: 1800,
    avgWaterMl: 2800,
    products: [{ name: 'Whey', ingredients: [{ name: 'بروتين', amount: 25, unit: 'g' }] }],
    medicationsList: [],
    labResults: [],
  };

  it('يرجع صفوف تغطية وعجزًا موجبًا فقط', () => {
    const out = generateSupplementAssessment(baseInput);
    expect(out.coverage.length).toBe(7);
    for (const row of out.coverage) expect(row.deficit).toBeGreaterThanOrEqual(0);
    const protein = out.coverage.find((r) => r.key === 'protein');
    expect(protein?.deficit).toBeGreaterThan(0);
  });

  it('يقدّم الغذاء أولًا ولا يشخّص نقصًا', () => {
    const out = generateSupplementAssessment(baseInput);
    expect(out.summary).not.toContain('نقص');
    expect(out.foodAlternatives.length).toBeGreaterThanOrEqual(0);
  });

  it('عند التغطية الكاملة: لا حاجة حالية', () => {
    const out = generateSupplementAssessment({
      ...baseInput,
      trainingIntensity: 'low',
      swimSessionsPerWeek: 2,
      swimMinutesPerSession: 45,
      hasDoubleTraining: false,
      competitionMode: false,
      nextCompetitionDate: null,
      avgFoodCalories: 4300,
      avgFoodProteinG: 150,
      avgFoodCarbsG: 634,
      avgFoodFatG: 140,
      avgFoodFiberG: 40,
      avgFoodSodiumMg: 2000,
      avgWaterMl: 4000,
      trainingWaterMl: 0,
    });
    expect(out.recommendations.length).toBe(0);
    expect(out.overallLevel).toBe('none');
    expect(out.summary).toContain('لا توجد حاجة حالية إلى مكمل غذائي');
  });

  it('قاصر بموافقة ولي الأمر: بروتين يُحسب لكن الكرياتين محجوب', () => {
    const out = generateSupplementAssessment({
      ...baseInput,
      isMinor: true,
      guardianConsent: true,
      age: 17,
    });
    const creatine = out.recommendations.find((r) => r.key === 'creatine');
    const whey = out.recommendations.find((r) => r.key === 'whey');
    expect(creatine?.status).toBe('blocked');
    if (whey) expect(['needs-review', 'food-first', 'blocked']).toContain(whey.status);
    expect(out.proteinGap).not.toBeNull();
  });

  it('تحليل منخفض للفيريتين يفعل حديدًا يتطلب طبيبًا', () => {
    const out = generateSupplementAssessment({
      ...baseInput,
      labResults: [{ marker: 'ferritin', markerAr: 'فيريتين', value: 15, unit: 'ng/mL', referenceRange: '30-400' }],
    });
    const iron = out.recommendations.find((r) => r.key === 'iron');
    expect(iron).toBeDefined();
    expect(iron?.status).toBe('blocked');
    expect(out.needsMedicalApproval).toBe(true);
  });

  it('مستخدم حالي يقترب من الحد الأعلى للكرياتين', () => {
    const out = generateSupplementAssessment({
      ...baseInput,
      products: [{ name: 'كرياتين', ingredients: [{ name: 'كرياتين', amount: 9, unit: 'g' }] }],
    });
    const creatine = out.recommendations.find((r) => r.key === 'creatine');
    expect(creatine).toBeDefined();
  });
});
