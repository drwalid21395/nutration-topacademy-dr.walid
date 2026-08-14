/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/plan/service.ts

وظيفة الملف:
"خدمة إنشاء الخطط الغذائية وحفظها" — تجمع بين:
1. تحميل قاعدة بيانات الأطعمة (من جدول FoodItem).
2. حساب الاحتياجات عبر summarizeNutrition.
3. توليد الخطة الذكية عبر generatePlan.
4. حفظ الخطة والوجبات في قاعدة البيانات (Prisma).

لماذا نحتاجه؟
حتى تُترجم الحسابات إلى خطة كاملة محفوظة يستطيع السباح فتحها
واستعراضها وتصديرها PDF.

متى تعمل؟
عند طلب "إنشاء خطة" من حساب السباح (من ملفه ونطاقاته المحفوظة).

من يستدعي هذا الملف؟
واجهة API لإنشاء الخطط (src/app/api/plans/... أو ما يعادله).

الملفات التي يتعامل معها:
- @/lib/prisma → prisma (الوصول لقاعدة البيانات).
- @/services/nutrition → summarizeNutrition (الحسابات).
- @/services/plan-generator/plan-generator → generatePlan و أنواعه.
- @/lib/constants → PLAN_TYPES (أسماء أنواع الخطط).

ترتيب العمل:
طلب إنشاء خطة (CreatePlanInput) ↓
تحميل الأهداف والملف وقاعدة الأطعمة بالتوازي ↓
حساب الاحتياجات من ملف السباح ↓
توليد الخطة الذكية (وجبات + بدائل) ↓
حفظ الخطة (إلغاء السابقة) + الوجبات والعناصر ↓
ترجع الخطة المحفوظة والنتيجة

ملاحظة مهمة:
هذه طبقة "منطق أعمال" — تتعامل مع قاعدة البيانات وتنسّق
الخدمات الأخرى، ولا تعرض أي واجهة.
==================================================
*/

/**
 * خدمة إنشاء الخطط الغذائية وحفظها في قاعدة البيانات.
 * تجمع بين محرك الحسابات والمولد الذكي.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// prisma: عميل قاعدة البيانات (أورم Prisma) من ملف محلي.
import { prisma } from '@/lib/prisma';
// summarizeNutrition: حساب الاحتياجات الغذائية من خدمات التغذية.
import { summarizeNutrition } from '@/services/nutrition';
// generatePlan: المولد الذكي للخطة. PlanFood: شكل الطعام. GeneratedPlan: شكل الخطة المولدة.
import { generatePlan, type PlanFood, type GeneratedPlan } from '@/services/plan-generator/plan-generator';
// PLAN_TYPES: أسماء أنواع الخطط (أسبوعية، مزدوجة...) من الثوابت.
import { PLAN_TYPES } from '@/lib/constants';

// ========================================
// 2. تحميل قاعدة بيانات الأطعمة
// ========================================

/*
-----------------------------------------
الدالة: loadFoodDb
-----------------------------------------
وظيفتها: تحميل كل الأطعمة النشطة من قاعدة البيانات مع تصنيفاتها.
Input: بلا مدخلات.
Processing:
  - استعلام Prisma عن FoodItem النشطة فقط مع تصنيفاتها.
  - تحويل كل صف إلى كائن PlanFood بسيط جاهز للمولد.
Output: مصفوفة PlanFood[].
من يستدعيها؟ createPlanFromTargets.
ماذا تستدعي هي؟ prisma.foodItem.findMany.
-----------------------------------------
*/
export async function loadFoodDb(): Promise<PlanFood[]> {
  const foods = await prisma.foodItem.findMany({
    where: { isActive: true },
    include: { category: true },
  });
  // تحويل حقل null إلى قيمة افتراضية مناسبة لكل حقل.
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

// ========================================
// 3. مدخلات إنشاء الخطة
// ========================================

// كل ما يحتاجه إنشاء خطة: المستخدم، الملف والنطاقات المحفوظة،
// مدة الخطة، نوعها، الهدف، ونمط البطولة.
export interface CreatePlanInput {
  userId: string;
  profileId?: string;
  targetsId?: string;
  durationDays: number;
  planType: string;
  goal?: string;
  isCompetition?: boolean;
}

// ========================================
// 4. الدالة الرئيسية: إنشاء خطة من النطاقات
// ========================================

/*
-----------------------------------------
الدالة: createPlanFromTargets
-----------------------------------------
وظيفتها: بناء خطة كاملة (حسابات + توليد + حفظ).
Input: CreatePlanInput.
Processing:
  1. تحميل النطاقات المحفوظة، ملف السباح، قاعدة الأطعمة، والمستخدم بالتوازي.
  2. التأكد من وجود النطاقات والملف (وإلا خطأ واضح).
  3. حساب الاحتياجات من ملف السباح.
  4. اختيار اسم الخطة من PLAN_TYPES.
  5. توليد الخطة الذكية من النتيجة وقواعد المولد.
  6. حفظ الخطة في قاعدة البيانات.
Output: { planId، plan، generated، summary }.
من يستدعيها؟ واجهة إنشاء الخطط.
ماذا تستدعي هي؟ loadFoodDb، summarizeNutrition، generatePlan، persistPlan.
-----------------------------------------
*/
export async function createPlanFromTargets(input: CreatePlanInput) {
  // تحميل البيانات الأربعة معًا بشكل متوازٍ (أسرع من التتابع).
  const [targets, profile, foodDb, profileUser] = await Promise.all([
    input.targetsId
      ? prisma.nutritionTargets.findUnique({ where: { id: input.targetsId } })
      : null,
    input.profileId
      ? prisma.swimmerProfile.findUnique({ where: { id: input.profileId } })
      : null,
    loadFoodDb(),
    // ملاحظة: يبدو أن profileUser (بيانات المستخدم) غير مستخدم حاليًا
    // داخل هذه الدالة — يجب التأكد قبل حذفه، وتركنا السلوك دون تغيير.
    prisma.user.findUnique({ where: { id: input.userId } }),
  ]);

  // لا يمكن المتابعة دون النطاقات المحفوظة أو ملف السباح.
  if (!targets) throw new Error('لا توجد نتائج احتياجات محفوظة');
  if (!profile) throw new Error('لا يوجد ملف سباح');

  // حساب الاحتياجات الغذائية من بيانات ملف السباح
  // (بقيم افتراضية آمنة عند غياب أي حقل اختياري).
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

  // اسم الخطة من جدول الأنواع (الافتراضي: أسبوع).
  const planName =
    PLAN_TYPES[input.planType as keyof typeof PLAN_TYPES] ??
    PLAN_TYPES.week;

  // توليد الخطة الذكية من النتائج وبيانات ملف السباح.
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

  // حفظ الخطة والوجبات في قاعدة البيانات.
  const plan = await persistPlan(input, summary.result, generated, planName);

  // نرجع كل شيء للمتصل.
  return { planId: plan.id, plan, generated, summary };
}

// ========================================
// 5. حفظ الخطة في قاعدة البيانات
// ========================================

/*
-----------------------------------------
الدالة: persistPlan
-----------------------------------------
وظيفتها: حفظ الخطة والوجبات والعناصر في قاعدة البيانات.
Input: المدخلات، النتيجة، الخطة المولدة، واسم الخطة.
Processing:
  1. إلغاء تفعيل أي خطة سابقة للمستخدم.
  2. إنشاء سجل MealPlan جديد.
  3. المسار (PostgreSQL): كتابة مجمّعة createMany بمعرّفات UUID
     (أسرع من 100+ استعلام متسلسل).
  4. مسار SQLite (محلي): الكتابة المتسلسلة مع العناصر المتداخلة.
Output: سجل الخطة المحفوظ.
من يستدعيها؟ createPlanFromTargets.
ماذا تستدعي هي؟ prisma (mealPlan، meal، mealItem).
-----------------------------------------
*/
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

  // إنشاء سجل الخطة الرئيسي.
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
    // تجميع كل صفوف الوجبات والعناصر في مصفوفتين ثم إدراجهما دفعة واحدة.
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

    // لكل يوم ولكل وجبة ننشئ معرّف UUID ونضيف الوجبة ثم عناصرها.
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
        // عناصر الوجبة الأساسية.
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
        // عناصر البدائل (اقتصادي/نباتي/خالٍ من اللاكتوز...) بوضع isAlternative.
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

    // إدراج الوجبات دفعة واحدة، ثم العناصر في مجموعات من 500.
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
            // العناصر الأساسية والبدائل تُنشأ مباشرة داخل الوجبة.
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

// ========================================
// 6. نوع مساعد
// ========================================

// شكل مبسّط لنتيجة التغذية — الحقول التي يحتاجها الحفظ فقط.
type NutritionResultLike = {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  formula?: string;
};
