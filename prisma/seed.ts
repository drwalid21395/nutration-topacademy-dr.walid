/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
prisma/seed.ts

وظيفة الملف:
يملأ قاعدة البيانات ببيانات تجريبية جاهزة للاستخدام:
أطعمة وتصنيفات ومكملات، وحسابات تجريبية بكل الأدوار
(سباح / ولي أمر / مدرب / اختصاصي / مدير)، وملف سباح كامل
مع احتياجاته وخطته الأسبوعية وسجلاته وإشعاراته.

لماذا نحتاجه؟
بدون هذه البيانات ستكون قاعدة البيانات فارغة ولن تجد
أطعمة ولا حسابات تجرب بها الموقع. ندير السكربت مرة واحدة
بعد تهيئة قاعدة البيانات.

متى يعمل؟
بأمر: npm run db:seed

من يستدعي هذا الملف؟
سكربت npm (db:seed). لا يستدعيه أي مسار/مكوّن.

الملفات التي يتعامل معها:
- prisma/food-data.ts (الأطعمة والتصنيفات)
- prisma/supplement-data.ts و supplement-science-data.ts (المكملات)
- src/lib/prisma.ts (الاتصال بقاعدة البيانات)
- src/services/nutrition و plan/service و supplements/* (لحساب الخطة التجريبية)

تحذير مهم:
السكربت يحذف البيانات التجريبية ويعيد إنشاءها.
لا تُشغّله على قاعدة الإنتاج إلا بقصد واضح، لأنه يمس
بيانات المستخدمين (راجع AGENTS.md).
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================
// PrismaClient و Prisma: من مكتبة @prisma/client (node_modules) —
// الأدوات التي تتعامل مع قاعدة البيانات.
// bcrypt: مكتبة خارجية لتشفير كلمات المرور (هاش).
// بقية الاستيرادات: ملفات محلية من المشروع (البيانات والخدمات).
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { CATEGORIES, FOODS } from './food-data';
import { SUPPLEMENTS } from './supplement-data';
import { SUPPLEMENT_INGREDIENTS, SUPPLEMENT_REFERENCES } from './supplement-science-data';

import { prisma } from '../src/lib/prisma';
import { summarizeNutrition } from '../src/services/nutrition';
import { createPlanFromTargets } from '../src/services/plan/service';
import { SUPPLEMENT_PROFILES, type SupplementProfile } from '../src/services/supplements/profiles';
import { generateSupplementAssessment } from '../src/services/supplements/assessment';
import type { SupplementAssessmentInput } from '../src/services/supplements/types';

function profileToCreateInput(p: SupplementProfile): Prisma.SupplementCreateInput {
  return {
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    category: p.category,
    sortOrder: 0,
    descriptionAr: p.descriptionAr,
    functionAr: p.functionAr,
    consideredCasesAr: p.consideredCasesAr,
    avoidGroupsAr: p.avoidGroupsAr,
    sideEffectsAr: p.sideEffectsAr,
    interactionsAr: p.medicationInteractionsAr,
    naturalAlternativesAr: p.naturalAlternativesAr,
    isProhibitedRisk: false,
    needsLabTest: p.needsLabTest,
    needsMedicalSupervision: p.needsMedicalSupervision,
    key: p.key,
    scientificName: p.scientificName,
    evidenceStrength: p.evidenceStrength,
    minAge: p.minAge,
    suitableForMinors: p.suitableForMinors,
    needsRx: p.needsRx,
    linkedToWeight: p.linkedToWeight,
    linkedToTraining: p.linkedToTraining,
    linkedToCompetition: p.linkedToCompetition,
    doseUnit: p.doseUnit,
    minDose: p.minDose,
    maxDose: p.maxDose,
    safeUpperLimit: p.safeUpperLimit,
    timingAr: p.timingAr,
    relationToMealsAr: p.relationToMealsAr,
    durationDays: p.durationDays,
    stopPeriodAr: p.stopPeriodAr,
    medicationInteractionsAr: p.medicationInteractionsAr,
    supplementInteractionsAr: p.supplementInteractionsAr,
    contraindicationsAr: p.contraindicationsAr,
    stopSymptomsAr: p.stopSymptomsAr,
    dopingRisk: p.dopingRisk,
    thirdPartyTestedRecommended: p.thirdPartyTestedRecommended,
    referencesAr: p.referencesAr,
    lastInfoUpdate: new Date(`${p.lastInfoUpdateYear}-01-01`),
  };
}

async function main() {
  console.log('🌱 بدء البذر…');

  // ---- التنظيف (فقط البيانات القابلة للإعادة) ----
  await prisma.foodItem.deleteMany();
  await prisma.foodCategory.deleteMany();
  await prisma.supplement.deleteMany();
  await prisma.contentPage.deleteMany();

  const demoEmails = [
    'swimmer@demo.top',
    'guardian@demo.top',
    'coach@top.academy',
    'diet@top.academy',
    'admin@top.academy',
  ];
  for (const email of demoEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.delete({ where: { email } });
    }
  }

  // ---- التصنيفات والأطعمة ----
  for (const cat of CATEGORIES) {
    await prisma.foodCategory.create({ data: cat });
  }
  const categoryMap = new Map<string, string>();
  for (const c of await prisma.foodCategory.findMany()) {
    categoryMap.set(c.nameAr, c.id);
  }
  for (const f of FOODS) {
    await prisma.foodItem.create({
      data: {
        nameAr: f.nameAr,
        nameEn: f.nameEn ?? null,
        categoryId: categoryMap.get(f.category) ?? null,
        portionLabel: f.portionLabel,
        gramsPerPortion: f.gramsPerPortion,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        fiberG: f.fiberG,
        sugarsG: f.sugarsG,
        sodiumMg: f.sodiumMg,
        allergens: f.allergens,
        isPreWorkout: f.isPreWorkout ?? false,
        isPostWorkout: f.isPostWorkout ?? false,
        isCompetition: f.isCompetition ?? false,
        isKidFriendly: f.isKidFriendly ?? true,
        isVegetarian: f.isVegetarian ?? false,
        hasLactose: f.hasLactose ?? false,
        hasGluten: f.hasGluten ?? false,
        isCommon: f.isCommon ?? false,
      },
    });
  }
  console.log(`✔ الأطعمة: ${FOODS.length} صنفًا`);

  // ---- المكملات (ملفات علمية + بطاقة التحذير من المشبوهة) ----
  for (const p of SUPPLEMENT_PROFILES) {
    await prisma.supplement.create({ data: profileToCreateInput(p) });
  }
  for (const s of SUPPLEMENTS.filter((x) => x.isProhibitedRisk)) {
    await prisma.supplement.create({ data: s });
  }
  console.log(`✔ المكملات: ${SUPPLEMENT_PROFILES.length + SUPPLEMENTS.filter((x) => x.isProhibitedRisk).length}`);

  // ---- مكونات الحدود العليا والمراجع ----
  for (const ing of SUPPLEMENT_INGREDIENTS) {
    await prisma.supplementIngredient.create({ data: ing });
  }
  for (const ref of SUPPLEMENT_REFERENCES) {
    await prisma.supplementReference.create({ data: ref });
  }
  console.log(`✔ مكونات المكملات: ${SUPPLEMENT_INGREDIENTS.length} · مراجع: ${SUPPLEMENT_REFERENCES.length}`);

  // ---- صفحات المحتوى ----
  await prisma.contentPage.createMany({
    data: [
      { slug: 'privacy', titleAr: 'سياسة الخصوصية', bodyAr: 'نظرة عامة على سياسة الخصوصية.', published: true },
      { slug: 'terms', titleAr: 'شروط الاستخدام', bodyAr: 'نظرة عامة على شروط الاستخدام.', published: true },
      { slug: 'medical-disclaimer', titleAr: 'إخلاء المسؤولية الطبية', bodyAr: 'الخطط إرشادية وغير علاجية.', published: true },
    ],
  });

  // ---- المستخدمون التجريبيون ----
  const admin = await prisma.user.create({
    data: {
      name: 'مدير النظام',
      email: 'admin@top.academy',
      passwordHash: await bcrypt.hash('Admin@1234', 10),
      role: 'admin',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  const coach = await prisma.user.create({
    data: {
      name: 'كابتن خالد السباح',
      email: 'coach@top.academy',
      passwordHash: await bcrypt.hash('Coach@1234', 10),
      role: 'coach',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  const dietitian = await prisma.user.create({
    data: {
      name: 'أ. سارة التغذية',
      email: 'diet@top.academy',
      passwordHash: await bcrypt.hash('Diet@1234', 10),
      role: 'dietitian',
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });

  // ---- السباح التجريبي (17 سنة) ----
  const athlete = await prisma.user.create({
    data: {
      name: 'أحمد السباح',
      email: 'swimmer@demo.top',
      passwordHash: await bcrypt.hash('Demo@1234', 10),
      role: 'athlete',
      acceptTerms: true,
      acceptPrivacy: true,
      isAdult: false,
    },
  });

  const profile = await prisma.swimmerProfile.create({
    data: {
      userId: athlete.id,
      fullName: 'أحمد محمد السباح',
      gender: 'male',
      birthDate: new Date('2008-05-15'),
      age: 17,
      heightCm: 178,
      weightKg: 70,
      targetWeightKg: 72,
      bodyFatPercent: 12,
      country: 'مصر',
      ageGroup: 'youth',
      swimmerLevel: 'competitor',
      specialty: 'freestyle',
      mainDistances: '50, 100, 200',
      nextCompetitionDate: new Date(Date.now() + 21 * 86400000),
      swimSessionsPerWeek: 6,
      swimMinutesPerSession: 120,
      trainingIntensity: 'high',
      swimDistancePerSession: 4000,
      gymSessionsPerWeek: 3,
      gymMinutesPerSession: 60,
      gymType: 'mixed',
      hasDoubleTraining: true,
      sleepHours: 8,
      dailyActivityLevel: 'veryActive',
      goal: 'competition',
      dietType: 'regular',
      preferredMealsPerDay: 6,
      budgetLevel: 'medium',
      isMinor: true,
      guardianData: JSON.stringify({ name: 'والد أحمد', phone: '01000000000' }),
      medicalAlert: true,
    },
  });

  const summary = summarizeNutrition({
    gender: 'male',
    age: 17,
    heightCm: 178,
    weightKg: 70,
    bodyFatPercent: 12,
    goal: 'competition',
    swimmerLevel: 'competitor',
    swimSessionsPerWeek: 6,
    swimMinutesPerSession: 120,
    trainingIntensity: 'high',
    gymSessionsPerWeek: 3,
    gymMinutesPerSession: 60,
    gymType: 'mixed',
    dailyActivityLevel: 'veryActive',
    preferredMealsPerDay: 6,
    isMinor: true,
    hasDoubleTraining: true,
    nextCompetitionDate: new Date(Date.now() + 21 * 86400000),
  });

  const r = summary.result;
  const targets = await prisma.nutritionTargets.create({
    data: {
      profileId: profile.id,
      bmi: r.bmi,
      bmiCategory: r.bmiCategory,
      bmr: r.bmr,
      tdee: r.tdee,
      calories: r.calories,
      calorieMin: r.calorieMin,
      calorieMax: r.calorieMax,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      fiberG: r.fiberG,
      waterMl: r.waterMl,
      trainingWaterMl: r.trainingWaterMl,
      sodiumMg: r.sodiumMg,
      proteinPct: r.proteinPct,
      carbsPct: r.carbsPct,
      fatPct: r.fatPct,
      mealCalories: JSON.stringify(r.mealCalories ?? {}),
      trainingCalories: JSON.stringify(r.trainingCalories ?? {}),
      formula: r.formula,
      recommendations: JSON.stringify(r.recommendations ?? {}),
    },
  });

  console.log(`✔ السباح ${profile.fullName}: ${r.calories} سعرة/يوم، ${r.proteinG} جم بروتين`);

  // ---- الخطة الأسبوعية ----
  const { planId } = await createPlanFromTargets({
    userId: athlete.id,
    profileId: profile.id,
    targetsId: targets.id,
    durationDays: 7,
    planType: 'week',
    goal: 'competition',
  });
  console.log(`✔ الخطة الأسبوعية: ${planId}`);

  // ---- سجلات تجريبية ----
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    await prisma.foodLogEntry.create({
      data: {
        userId: athlete.id,
        date: day,
        mealType: 'breakfast',
        foodName: 'بيض + شوفان + موز',
        calories: 620,
        proteinG: 35,
        carbsG: 78,
        fatG: 18,
        source: 'manual',
      },
    });
    await prisma.foodLogEntry.create({
      data: {
        userId: athlete.id,
        date: day,
        mealType: 'lunch',
        foodName: 'صدر دجاج + أرز + سلطة',
        calories: 780,
        proteinG: 52,
        carbsG: 90,
        fatG: 20,
        source: 'manual',
      },
    });
    await prisma.waterLogEntry.create({
      data: { userId: athlete.id, date: day, amountMl: 250 },
    });
    await prisma.waterLogEntry.create({
      data: { userId: athlete.id, date: day, amountMl: 500 },
    });
    await prisma.trainingLogEntry.create({
      data: {
        userId: athlete.id,
        date: day,
        sessionType: 'swim',
        durationMin: 120,
        distanceM: 4000,
        intensity: 'high',
        caloriesBurned: 650,
      },
    });
    await prisma.recoveryLogEntry.create({
      data: {
        userId: athlete.id,
        date: day,
        sleepHours: 7.5,
        energyLevel: 8,
        hungerLevel: 6,
        stressLevel: 4,
        recoveryLevel: 7,
      },
    });
    await prisma.weightLogEntry.create({
      data: { userId: athlete.id, date: day, weightKg: 70 + (i === 0 ? 0.4 : 0.2) },
    });
  }
  console.log('✔ سجلات يومية تجريبية (طعام/ماء/تدريب/استشفاء/وزن)');

  // ---- إشعارات تجريبية ----
  await prisma.notificationPref.create({
    data: {
      userId: athlete.id,
      breakfastTime: '08:00',
      lunchTime: '14:00',
      dinnerTime: '20:00',
      waterInterval: 60,
      sleepTime: '23:00',
      weighInTime: '07:00',
      competitionReminderDays: 7,
      planReviewReminderDays: 14,
      soundEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      smartAlerts: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
      days: JSON.stringify(['sat', 'sun', 'mon', 'tue', 'wed', 'thu']),
    },
  });
  await prisma.notification.createMany({
    data: [
      { userId: athlete.id, type: 'system', title: 'أهلًا بك في منصة Top Academy', body: 'أكمل ملف السباح الخاص بك وابدأ رحلتك الغذائية الذكية.', channel: 'inapp' },
      { userId: athlete.id, type: 'review', title: 'خطتك الأسبوعية جاهزة', body: `خطة أسبوعية باحتياجاتك (${r.calories} سعرة/يوم) — يمكنك تصديرها PDF.`, channel: 'inapp' },
      { userId: athlete.id, type: 'smart', title: 'لا تنسَ شرب الماء', body: 'أدخلت سجلات تدريب اليوم؛ تأكد من ترطيب جسمك جيدًا.', channel: 'inapp' },
    ],
  });

  // ---- علاقة مدرب واختصاصي ----
  await prisma.coachRelation.create({
    data: {
      coachId: coach.id,
      athleteId: athlete.id,
      status: 'active',
      canViewHealth: true,
      canEditPlan: true,
    },
  });
  await prisma.coachRelation.create({
    data: {
      coachId: dietitian.id,
      athleteId: athlete.id,
      status: 'active',
      canViewHealth: true,
      canEditPlan: false,
    },
  });

  // ---- بطولة تجريبية ----
  await prisma.competition.create({
    data: {
      userId: athlete.id,
      profileId: profile.id,
      name: 'بطولة الجمهورية للناشئين — 50م حرة',
      startDate: new Date(Date.now() + 21 * 86400000),
      endDate: new Date(Date.now() + 23 * 86400000),
      location: 'مجمع محمد علي حمادة',
      expectedTemp: 'معتدل',
      races: JSON.stringify([{ number: 1, name: '50م حرة', time: '10:00' }, { number: 2, name: '100م حرة', time: '11:30' }]),
      isActive: true,
    },
  });
  console.log('✔ بطولة تجريبية');

  // ---- حاسبة المكملات: بيانات تجريبية ----
  const wheyProduct = await prisma.supplementProduct.create({
    data: {
      userId: athlete.id,
      name: 'Whey Gold Isolate',
      brand: 'بورتر للتغذية',
      ingredientsJson: JSON.stringify([{ name: 'بروتين', amount: 25, unit: 'g' }]),
      batchVerified: false,
      thirdPartyTested: true,
      dopingRisk: 'low',
      dailyDose: '25 جم بعد التدريب',
      notes: 'منتج بتحليل جهة خارجية موثق.',
    },
  });
  await prisma.supplementProduct.create({
    data: {
      userId: athlete.id,
      name: 'كرياتين مونوهيدرات مسحوق',
      brand: 'سبورت لايف',
      ingredientsJson: JSON.stringify([{ name: 'كرياتين', amount: 5, unit: 'g' }]),
      batchVerified: true,
      thirdPartyTested: true,
      dopingRisk: 'low',
      dailyDose: '5 جم يوميًا',
      expiryDate: new Date(Date.now() + 300 * 86400000),
    },
  });
  await prisma.medication.create({
    data: {
      userId: athlete.id,
      name: 'أموكسيسيلين 500',
      purpose: 'كورس مضاد حيوي سابق (منتهٍ)',
      dosage: '500 ملجم',
      frequency: 'كل 8 ساعات — منتهٍ',
    },
  });
  await prisma.labResult.create({
    data: { userId: athlete.id, marker: 'ferritin', markerAr: 'فيريتين', value: 18, unit: 'ng/mL', referenceRange: '30-400', testDate: new Date(Date.now() - 10 * 86400000) },
  });
  await prisma.labResult.create({
    data: { userId: athlete.id, marker: 'vitaminD', markerAr: 'فيتامين د 25-OH', value: 22, unit: 'ng/mL', referenceRange: '30-100', testDate: new Date(Date.now() - 10 * 86400000) },
  });
  await prisma.labResult.create({
    data: { userId: athlete.id, marker: 'hemoglobin', markerAr: 'هيموجلوبين', value: 14.2, unit: 'g/dL', referenceRange: '13-17', testDate: new Date(Date.now() - 10 * 86400000) },
  });
  await prisma.supplementIntakeLog.create({
    data: {
      userId: athlete.id,
      productId: wheyProduct.id,
      supplementName: 'بروتين مصل اللبن',
      doseAmount: 25,
      doseUnit: 'g',
      withFood: true,
      compliant: true,
      logDate: new Date(Date.now() - 86400000),
    },
  });
  await prisma.supplementIntakeLog.create({
    data: {
      userId: athlete.id,
      productId: wheyProduct.id,
      supplementName: 'بروتين مصل اللبن',
      doseAmount: 25,
      doseUnit: 'g',
      withFood: false,
      compliant: true,
      energyLevel: 7,
      recoveryLevel: 7,
      logDate: new Date(Date.now() - 2 * 86400000),
    },
  });
  console.log('✔ حاسبة المكملات: منتجات وأدوية وتحاليل وسجل تعاطي');

  // ---- تقييم حاسبة المكملات (تجريبي، يُحسب بالمحرك) ----
  const assessmentInput: SupplementAssessmentInput = {
    profileId: profile.id,
    isMinor: true,
    guardianConsent: true,
    age: 17,
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
    dailyCaloriesTarget: r.calories ?? null,
    proteinTarget: r.proteinG ?? null,
    carbsTarget: r.carbsG ?? null,
    fatTarget: r.fatG ?? null,
    fiberTarget: r.fiberG ?? null,
    waterTarget: r.waterMl ?? null,
    trainingWaterMl: r.trainingWaterMl ?? null,
    sodiumTarget: r.sodiumMg ?? 2000,
    avgFoodCalories: Math.round((r.calories ?? 4000) * 0.88),
    avgFoodProteinG: Math.round((r.proteinG ?? 140) * 0.85),
    avgFoodCarbsG: Math.round((r.carbsG ?? 480) * 0.9),
    avgFoodFatG: Math.round((r.fatG ?? 170) * 0.92),
    avgFoodFiberG: Math.round((r.fiberG ?? 38) * 0.8),
    avgFoodSodiumMg: Math.round((r.sodiumMg ?? 2000) * 0.9),
    avgWaterMl: Math.round((r.waterMl ?? 3500) * 0.7),
    products: [{ name: 'Whey Gold Isolate', ingredients: [{ name: 'بروتين', amount: 25, unit: 'g' }] }],
    medicationsList: [],
    labResults: [
      { marker: 'ferritin', markerAr: 'فيريتين', value: 18, unit: 'ng/mL', referenceRange: '30-400' },
      { marker: 'vitaminD', markerAr: 'فيتامين د 25-OH', value: 22, unit: 'ng/mL', referenceRange: '30-100' },
      { marker: 'hemoglobin', markerAr: 'هيموجلوبين', value: 14.2, unit: 'g/dL', referenceRange: '13-17' },
    ],
  };

  const assessment = generateSupplementAssessment(assessmentInput);
  await prisma.supplementAssessment.create({
    data: {
      userId: athlete.id,
      profileId: profile.id,
      version: assessment.version,
      status: 'needs-review',
      overallLevel: assessment.overallLevel,
      needsMedicalApproval: assessment.needsMedicalApproval,
      needsGuardianConsent: assessment.needsGuardianConsent,
      needsLabTest: assessment.needsLabTest,
      coverage: JSON.stringify(assessment.coverage),
      eligibility: JSON.stringify(assessment.eligibility),
      proteinGap: JSON.stringify(assessment.proteinGap),
      hydration: JSON.stringify(assessment.hydration),
      recommendations: JSON.stringify(assessment.recommendations),
      schedule: JSON.stringify(assessment.schedule),
      foodAlternatives: JSON.stringify(assessment.foodAlternatives),
      reassessAt: new Date(Date.now() + 30 * 86400000),
      recommendationItems: {
        create: assessment.recommendations.map((rec) => ({
          supplementKey: rec.key,
          nameAr: rec.nameAr,
          status: rec.status,
          eligibilityVerdict: rec.verdict,
          evidenceStrength: rec.evidenceStrength,
          coverageFromFood: rec.coverageFromFoodPct,
          deficit: rec.deficit,
          doseEstimate: rec.doseEstimate,
          doseUnit: rec.doseUnit,
          timingAr: rec.timingAr,
          durationDays: rec.durationDays,
          upperLimitWarning: rec.upperLimitWarning,
          medicalNote: rec.medicalNote,
        })),
      },
    },
  });
  console.log(`✔ تقييم مكملات تجريبي: ${assessment.recommendations.length} توصية، مستوى عام: ${assessment.overallLevel}`);

  console.log('✅ اكتمل البذر بنجاح.');
  console.log('');
  console.log('🔑 حسابات تجريبية:');
  console.log('  السباح:   swimmer@demo.top   / Demo@1234');
  console.log('  المدرب:   coach@top.academy  / Coach@1234');
  console.log('  اختصاصي:  diet@top.academy   / Diet@1234');
  console.log('  المدير:   admin@top.academy  / Admin@1234');
  console.log('  (لا يوجد حساب ولي أمر منفصل — يمكن إنشاؤه من التسجيل)');
  console.log(`  إعداد الاحتياجات: ${r.calories} سعرة · ${r.proteinG} جم بروتين · ${r.carbsG} جم كربوهيدرات · ${r.fatG} جم دهون · ماء ${r.waterMl} مل`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
