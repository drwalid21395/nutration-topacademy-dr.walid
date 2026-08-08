/**
 * خدمة إنشاء الخطط الغذائية وحفظها في قاعدة البيانات.
 * تجمع بين محرك الحسابات والمولد الذكي.
 */
import { prisma } from '@/lib/prisma';
import { summarizeNutrition } from '@/services/nutrition';
import { generatePlan, type PlanFood, type GeneratedPlan } from '@/services/plan-generator/plan-generator';
import { PLAN_TYPES } from '@/lib/constants';

export async function loadFoodDb(): Promise<PlanFood[]> {
  const foods = await prisma.foodItem.findMany({
    where: { isActive: true },
    include: { category: true },
  });
  return foods.map((f) => ({
    id: f.id,
    nameAr: f.nameAr,
    category: f.category?.nameAr ?? '',
    portionLabel: f.portionLabel ?? '',
    gramsPerPortion: f.gramsPerPortion ?? 100,
    calories: f.calories ?? 0,
    proteinG: f.proteinG ?? 0,
    carbsG: f.carbsG ?? 0,
    fatG: f.fatG ?? 0,
    fiberG: f.fiberG ?? 0,
    isPreWorkout: f.isPreWorkout,
    isPostWorkout: f.isPostWorkout,
    isCompetition: f.isCompetition,
    isKidFriendly: f.isKidFriendly,
    isVegetarian: f.isVegetarian,
    hasLactose: f.hasLactose,
    hasGluten: f.hasGluten,
    isCommon: f.isCommon,
    allergens: f.allergens ?? undefined,
  }));
}

export interface CreatePlanInput {
  userId: string;
  profileId?: string;
  targetsId?: string;
  durationDays: number;
  planType: string;
  goal?: string;
  isCompetition?: boolean;
}

export async function createPlanFromTargets(input: CreatePlanInput) {
  const [targets, profile, foodDb, profileUser] = await Promise.all([
    input.targetsId
      ? prisma.nutritionTargets.findUnique({ where: { id: input.targetsId } })
      : null,
    input.profileId
      ? prisma.swimmerProfile.findUnique({ where: { id: input.profileId } })
      : null,
    loadFoodDb(),
    prisma.user.findUnique({ where: { id: input.userId } }),
  ]);

  if (!targets) throw new Error('لا توجد نتائج احتياجات محفوظة');
  if (!profile) throw new Error('لا يوجد ملف سباح');

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

  const planName =
    PLAN_TYPES[input.planType as keyof typeof PLAN_TYPES] ??
    PLAN_TYPES.week;

  const generated = generatePlan({
    calories: summary.result.calories ?? 0,
    proteinG: summary.result.proteinG ?? 0,
    carbsG: summary.result.carbsG ?? 0,
    fatG: summary.result.fatG ?? 0,
    mealsPerDay: profile.preferredMealsPerDay ?? 5,
    durationDays: input.durationDays,
    mealCalories: summary.result.mealCalories,
    goal: profile.goal ?? undefined,
    allergies: profile.allergies ?? undefined,
    dislikedFoods: profile.dislikedFoods ?? undefined,
    dietType: profile.dietType ?? undefined,
    budgetLevel: profile.budgetLevel ?? undefined,
    availableFoods: profile.availableFoods ?? undefined,
    isCompetition: input.isCompetition ?? false,
    swimmerLevel: profile.swimmerLevel ?? undefined,
    foodDb,
  });

  const plan = await persistPlan(input, summary.result, generated, planName);

  return { planId: plan.id, plan, generated, summary };
}

async function persistPlan(
  input: CreatePlanInput,
  result: NutritionResultLike,
  generated: GeneratedPlan,
  planName: string
) {
  // إلغاء تفعيل الخطة السابقة إن وجدت
  await prisma.mealPlan.updateMany({
    where: { userId: input.userId, isActive: true },
    data: { isActive: false },
  });

  const plan = await prisma.mealPlan.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      targetsId: input.targetsId,
      title: `${planName} — ${result.calories ?? ''} سعرة`,
      durationDays: input.durationDays,
      planType: input.planType,
      goal: input.goal,
      totalCalories: result.calories,
      proteinG: result.proteinG,
      carbsG: result.carbsG,
      fatG: result.fatG,
      waterMl: result.waterMl,
      mealsPerDay: generated.days[0]?.length ?? 5,
      isCompetitionMode: input.isCompetition ?? false,
      isActive: true,
      generatedWith: result.formula,
    },
  });

  // على PostgreSQL (الإنتاج): كتابة مجمّعة بمعرّفات مولّدة — أسرع بكثير
  // من 100+ استعلام متسلسل، ويمنع انتهاء مهلة الدالة في الخطط الطويلة.
  if (!(process.env.DATABASE_URL ?? '').startsWith('file:')) {
    const mealRows: {
      id: string;
      planId: string;
      dayNumber: number;
      mealType: string;
      title: string;
      timing: string | null;
      calories: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
      note: string | null;
    }[] = [];
    const itemRows: {
      id: string;
      mealId: string;
      foodNameAr: string;
      quantity: string | null;
      grams: number | null;
      calories: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
      isAlternative: boolean;
      alternativeType: string | null;
    }[] = [];

    for (let d = 0; d < generated.days.length; d++) {
      for (const m of generated.days[d]) {
        const mealId = crypto.randomUUID();
        mealRows.push({
          id: mealId,
          planId: plan.id,
          dayNumber: d + 1,
          mealType: m.mealType,
          title: m.title,
          timing: m.timing,
          calories: m.calories,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          note: m.note ?? null,
        });
        for (const it of m.items) {
          itemRows.push({
            id: crypto.randomUUID(),
            mealId,
            foodNameAr: it.foodNameAr,
            quantity: it.quantity,
            grams: it.grams,
            calories: it.calories,
            proteinG: it.proteinG,
            carbsG: it.carbsG,
            fatG: it.fatG,
            isAlternative: false,
            alternativeType: null,
          });
        }
        for (const [altType, altItems] of Object.entries(m.alternatives)) {
          for (const it of altItems) {
            itemRows.push({
              id: crypto.randomUUID(),
              mealId,
              foodNameAr: it.foodNameAr,
              quantity: it.quantity,
              grams: it.grams,
              calories: it.calories,
              proteinG: it.proteinG,
              carbsG: it.carbsG,
              fatG: it.fatG,
              isAlternative: true,
              alternativeType: altType,
            });
          }
        }
      }
    }

    await prisma.meal.createMany({ data: mealRows });
    const CHUNK = 500;
    for (let i = 0; i < itemRows.length; i += CHUNK) {
      await prisma.mealItem.createMany({ data: itemRows.slice(i, i + CHUNK) });
    }
    return plan;
  }

  // SQLite (البيئة المحلية): الكتابة المتسلسلة المعتادة مع العناصر المتداخلة.
  for (let d = 0; d < generated.days.length; d++) {
    const dayMeals = generated.days[d];
    for (const m of dayMeals) {
      await prisma.meal.create({
        data: {
          planId: plan.id,
          dayNumber: d + 1,
          mealType: m.mealType,
          title: m.title,
          timing: m.timing,
          calories: m.calories,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          note: m.note,
          items: {
            create: [
              ...m.items.map((it) => ({
                foodNameAr: it.foodNameAr,
                quantity: it.quantity,
                grams: it.grams,
                calories: it.calories,
                proteinG: it.proteinG,
                carbsG: it.carbsG,
                fatG: it.fatG,
              })),
              ...Object.entries(m.alternatives).flatMap(([altType, altItems]) =>
                altItems.map((it) => ({
                  foodNameAr: it.foodNameAr,
                  quantity: it.quantity,
                  grams: it.grams,
                  calories: it.calories,
                  proteinG: it.proteinG,
                  carbsG: it.carbsG,
                  fatG: it.fatG,
                  isAlternative: true,
                  alternativeType: altType,
                }))
              ),
            ],
          },
        },
      });
    }
  }

  return plan;
}

type NutritionResultLike = {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  formula?: string;
};
