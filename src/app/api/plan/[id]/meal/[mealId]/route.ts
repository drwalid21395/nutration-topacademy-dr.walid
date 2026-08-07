import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadFoodDb } from '@/services/plan/service';
import {
  MEAL_SLOTS,
  generateMealAlternatives,
} from '@/services/plan-generator/plan-generator';
import { rateLimit, audit } from '@/lib/security';

type RouteContext = { params: Promise<{ id: string; mealId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { id, mealId } = await ctx.params;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`plan-swap:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { alternativeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const alternativeType = body.alternativeType;
  if (!alternativeType) {
    return NextResponse.json({ error: 'اختر نوع البديل' }, { status: 400 });
  }

  const plan = await prisma.mealPlan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 });

  const meal = await prisma.meal.findUnique({
    where: { id: mealId },
    include: { items: true, plan: true },
  });
  if (!meal || meal.planId !== plan.id) {
    return NextResponse.json({ error: 'الوجبة غير موجودة' }, { status: 404 });
  }

  const realItems = meal.items.filter((it) => !it.isAlternative);
  const existingOfType = meal.items.filter(
    (it) => it.isAlternative && it.alternativeType === alternativeType
  );

  let chosenMacros: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }[] =
    existingOfType;

  try {
    if (chosenMacros.length === 0) {
      // لا بدائل محفوظة — توليدها على الطلب (للخطط القديمة) وحفظها
      const profile = plan.profileId
        ? await prisma.swimmerProfile.findUnique({ where: { id: plan.profileId } })
        : null;
      const foodDb = await loadFoodDb();
      const opts: Parameters<typeof generateMealAlternatives>[0] = {
        calories: plan.totalCalories ?? 2000,
        proteinG: plan.proteinG ?? 120,
        carbsG: plan.carbsG ?? 300,
        fatG: plan.fatG ?? 60,
        mealsPerDay: plan.mealsPerDay ?? 5,
        durationDays: plan.durationDays ?? 7,
        goal: plan.goal ?? undefined,
        allergies: profile?.allergies ?? undefined,
        dislikedFoods: profile?.dislikedFoods ?? undefined,
        dietType: profile?.dietType ?? undefined,
        budgetLevel: profile?.budgetLevel ?? undefined,
        availableFoods: profile?.availableFoods ?? undefined,
        isCompetition: plan.isCompetitionMode,
        swimmerLevel: profile?.swimmerLevel ?? undefined,
        foodDb,
      };
      const slots = MEAL_SLOTS[meal.mealType] ?? [];
      const itemsCals = realItems.reduce((a, it) => a + (it.calories ?? 0), 0);
      const generated = generateMealAlternatives(
        opts,
        slots,
        meal.calories ?? itemsCals,
        itemsCals
      );
      const generatedOfType = generated[alternativeType] ?? [];

      if (generatedOfType.length === 0) {
        return NextResponse.json(
          { error: 'لا توجد بدائل متاحة لهذه الوجبة' },
          { status: 400 }
        );
      }

      await prisma.mealItem.createMany({
        data: generatedOfType.map((it) => ({
          mealId: meal.id,
          foodNameAr: it.foodNameAr,
          quantity: it.quantity,
          grams: it.grams,
          calories: it.calories,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          isAlternative: true,
          alternativeType,
        })),
      });
      chosenMacros = generatedOfType;
    }

    const oldCal = realItems.reduce((a, it) => a + (it.calories ?? 0), 0);
    const oldP = realItems.reduce((a, it) => a + (it.proteinG ?? 0), 0);
    const oldC = realItems.reduce((a, it) => a + (it.carbsG ?? 0), 0);
    const oldF = realItems.reduce((a, it) => a + (it.fatG ?? 0), 0);

    const newCal = chosenMacros.reduce((a, it) => a + (it.calories ?? 0), 0);
    const newP = chosenMacros.reduce((a, it) => a + (it.proteinG ?? 0), 0);
    const newC = chosenMacros.reduce((a, it) => a + (it.carbsG ?? 0), 0);
    const newF = chosenMacros.reduce((a, it) => a + (it.fatG ?? 0), 0);

    // حذف المكونات الحالية، ثم ترقية البديل المختار إلى وجبة فعلية
    await prisma.mealItem.deleteMany({ where: { mealId: meal.id, isAlternative: false } });
    await prisma.mealItem.updateMany({
      where: { mealId: meal.id, alternativeType },
      data: { isAlternative: false, alternativeType: null },
    });

    await prisma.meal.update({
      where: { id: meal.id },
      data: {
        calories: Math.round(newCal),
        proteinG: Math.round(newP * 10) / 10,
        carbsG: Math.round(newC * 10) / 10,
        fatG: Math.round(newF * 10) / 10,
      },
    });

    await prisma.mealPlan.update({
      where: { id: plan.id },
      data: {
        totalCalories: Math.max(0, (plan.totalCalories ?? 0) + newCal - oldCal),
        proteinG: Math.max(0, (plan.proteinG ?? 0) + newP - oldP),
        carbsG: Math.max(0, (plan.carbsG ?? 0) + newC - oldC),
        fatG: Math.max(0, (plan.fatG ?? 0) + newF - oldF),
      },
    });

    await audit(user.id, 'plan.meal.swap', 'Meal', meal.id, { alternativeType });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر استبدال الوجبة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
