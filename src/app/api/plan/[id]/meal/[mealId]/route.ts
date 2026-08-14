/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/plan/[id]/meal/[mealId]/route.ts

وظيفة الملف:
واجهة API بحرف POST تستبدل وجبة في خطة غذائية ببديلها:
تولّد بدائل للوجبة (أو تستخدم البدائل المحفوظة)، تستبدل
المكونات، وتحدّث أرقام الخطة والوجبة بالتوازن الغذائي الجديد.

لماذا نحتاجه؟
عندما يريد السباح تغيير وجبة (مثل استبدال البروتين بدجاج بدل لحم)
يضغط زر البديل، وتتولى هذه الدالة إعادة الحسابات كاملة
حتى تبقى إجماليات الخطة صحيحة.

متى يعمل؟
عند وصول طلب POST إلى:
/api/plan/<معرّف الخطة>/meal/<معرّف الوجبة>
مثال: /api/plan/abc123/meal/xyz789

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. نقرأ المعرّفين من الرابط (params) ونمنع الطلبات الكثيرة → 429.
3. نتأكد أن الخطة تخص المستخدم، والوجبة تخص الخطة → 404 لو لا.
4. لو لا بدائل محفوظة من هذا النوع: نولّدها عبر generateMealAlternatives.
5. نحسب الفرق بين القديم والجديد (سعرات وبروتين وكربوهيدرات ودهون).
6. نحذف مكونات الوجبة الحالية ونرفّع البديل المختار إلى وجبة فعلية.
7. نحدّث أرقام الوجبة والخطة، نسجل العملية (audit)، ونرجع نجاحًا.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: نوع البديل غير محدد/لا بدائل متاحة.
- 401: غير مسجل. 404: الخطة/الوجبة غير موجودة.
- 429: طلبات كثيرة. 500: خطأ أثناء الاستبدال.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- loadFoodDb من services/plan/service (قاعدة الأطعمة).
- MEAL_SLOTS + generateMealAlternatives من services/plan-generator.
- rateLimit + audit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// loadFoodDb: من services/plan/service — تحميل قاعدة الأطعمة
// التي تُستخدم لتوليد البدائل الغذائية.
import { loadFoodDb } from '@/services/plan/service';
// MEAL_SLOTS + generateMealAlternatives: من services/plan-generator —
// خانات الوجبات + الدالة التي تولّد بدائل غذائية ذكية.
import {
  MEAL_SLOTS,
  generateMealAlternatives,
} from '@/services/plan-generator/plan-generator';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. نوع سياق المسار الديناميكي
// ========================================

// RouteContext: وصف لشكل "معاملات المسار".
// هذا المسار ديناميكي لأن مجلده [id]/meal/[mealId]:
// الأقواس [ ] تعني "أي قيمة تمر من هنا تكون معرّفًا".
// params: كائن يحمل id (معرّف الخطة) و mealId (معرّف الوجبة)،
// وهو Promise (وعد) — في Next.js 15 يُفك بـ await.
type RouteContext = { params: Promise<{ id: string; mealId: string }> };

// ========================================
// 3. معالج الطلب POST (استبدال الوجبة)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
// req: كائن الطلب (يحوي نوع البديل المطلوب).
// ctx: يحوي المعرّفين من الرابط — نقرأهما عبر await ctx.params.
export async function POST(req: NextRequest, ctx: RouteContext) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: استخراج معرّف الخطة ومعرّف الوجبة من الرابط.
  // await ctx.params: فك وعد المعاملات للحصول على القيم الفعلية.
  const { id, mealId } = await ctx.params;

  // الخطوة 3: منع الطلبات الكثيرة — 30 طلبًا في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`plan-swap:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 4: قراءة نوع البديل من جسم الطلب.
  let body: { alternativeType?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const alternativeType = body.alternativeType;
  if (!alternativeType) {
    return NextResponse.json({ error: 'اختر نوع البديل' }, { status: 400 });
  }

  // الخطوة 5: نتأكد أن الخطة موجودة وتملكها هذا المستخدم
  // (findFirst بشرط userId — لا يمكن استبدال وجبات خطة غيرك).
  const plan = await prisma.mealPlan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 });

  // نجلب الوجبة مع مكوناتها (items) وخطتها.
  const meal = await prisma.meal.findUnique({
    where: { id: mealId },
    include: { items: true, plan: true },
  });
  // نتأكد أن الوجبة موجودة وأنها تتبع هذه الخطة فعلًا.
  if (!meal || meal.planId !== plan.id) {
    return NextResponse.json({ error: 'الوجبة غير موجودة' }, { status: 404 });
  }

  // الخطوة 6: نفصل المكونات الحقيقية عن البدائل المحفوظة.
  // realItems: المكونات الفعلية للوجبة (ليست بدائل).
  // existingOfType: بدائل من نفس نوع البديل المطلوب (إن وُجدت محفوظة).
  const realItems = meal.items.filter((it) => !it.isAlternative);
  const existingOfType = meal.items.filter(
    (it) => it.isAlternative && it.alternativeType === alternativeType
  );

  // chosenMacros: البدائل التي سنستخدمها — نبدأ بما هو محفوظ.
  let chosenMacros: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }[] =
    existingOfType;

  try {
    // الخطوة 7: لو لا توجد بدائل محفوظة — نولّدها على الطلب.
    if (chosenMacros.length === 0) {
      // لا بدائل محفوظة — توليدها على الطلب (للخطط القديمة) وحفظها
      // ملف السباح المرتبط بالخطة (لتخصيص البدائل حسب حساسيته وأهدافه).
      const profile = plan.profileId
        ? await prisma.swimmerProfile.findUnique({ where: { id: plan.profileId } })
        : null;
      // تحميل قاعدة الأطعمة اللازمة للتوليد.
      const foodDb = await loadFoodDb();
      // opts: خيارات التوليد — قيم الخطة والملف (سعرات، بروتين،
      // حساسية، نظام غذائي، ميزانية...) تمر كلها للمولّد.
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
      // MEAL_SLOTS: خانات (أماكن) الوجبة حسب نوعها (فطور/غداء...).
      const slots = MEAL_SLOTS[meal.mealType] ?? [];
      // مجموع سعرات المكونات الحالية.
      const itemsCals = realItems.reduce((a, it) => a + (it.calories ?? 0), 0);
      // توليد البدائل الفعلية.
      const generated = generateMealAlternatives(
        opts,
        slots,
        meal.calories ?? itemsCals,
        itemsCals
      );
      // البدائل من النوع المطلوب فقط.
      const generatedOfType = generated[alternativeType] ?? [];

      // لو المولّد لم يجد بدائل من هذا النوع → 400.
      if (generatedOfType.length === 0) {
        return NextResponse.json(
          { error: 'لا توجد بدائل متاحة لهذه الوجبة' },
          { status: 400 }
        );
      }

      // حفظ البدائل المولّدة في جدول MealItem (كبدائل، ليست فعلية بعد).
      // createMany: إضافة عدة سجلات دفعة واحدة.
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

    // الخطوة 8: نحسب إجمالي القيم الغذائية للمكونات الحالية (القديمة)
    // وللبدائل المختارة (الجديدة) — reduce يجمع القيم.
    const oldCal = realItems.reduce((a, it) => a + (it.calories ?? 0), 0);
    const oldP = realItems.reduce((a, it) => a + (it.proteinG ?? 0), 0);
    const oldC = realItems.reduce((a, it) => a + (it.carbsG ?? 0), 0);
    const oldF = realItems.reduce((a, it) => a + (it.fatG ?? 0), 0);

    const newCal = chosenMacros.reduce((a, it) => a + (it.calories ?? 0), 0);
    const newP = chosenMacros.reduce((a, it) => a + (it.proteinG ?? 0), 0);
    const newC = chosenMacros.reduce((a, it) => a + (it.carbsG ?? 0), 0);
    const newF = chosenMacros.reduce((a, it) => a + (it.fatG ?? 0), 0);

    // الخطوة 9: تبديل المكونات — نحذف الفعلية، ونرفّع البديل المختار
    // إلى "وجبة فعلية" (isAlternative: false) لتصبح هي الوجبة.
    // حذف المكونات الحالية، ثم ترقية البديل المختار إلى وجبة فعلية
    await prisma.mealItem.deleteMany({ where: { mealId: meal.id, isAlternative: false } });
    await prisma.mealItem.updateMany({
      where: { mealId: meal.id, alternativeType },
      data: { isAlternative: false, alternativeType: null },
    });

    // الخطوة 10: تحديث أرقام الوجبة نفسها بالقيم الجديدة
    // (تقريب السعرات لعدد صحيح، والمغذيات لرقم عشري واحد).
    await prisma.meal.update({
      where: { id: meal.id },
      data: {
        calories: Math.round(newCal),
        proteinG: Math.round(newP * 10) / 10,
        carbsG: Math.round(newC * 10) / 10,
        fatG: Math.round(newF * 10) / 10,
      },
    });

    // الخطوة 11: تحديث إجماليات الخطة — نضيف الفرق (الجديد ناقص القديم)
    // Math.max(0, ...): نمنع النتيجة من النزول تحت الصفر.
    await prisma.mealPlan.update({
      where: { id: plan.id },
      data: {
        totalCalories: Math.max(0, (plan.totalCalories ?? 0) + newCal - oldCal),
        proteinG: Math.max(0, (plan.proteinG ?? 0) + newP - oldP),
        carbsG: Math.max(0, (plan.carbsG ?? 0) + newC - oldC),
        fatG: Math.max(0, (plan.fatG ?? 0) + newF - oldF),
      },
    });

    // الخطوة 12: تسجيل العملية في سجل التدقيق.
    await audit(user.id, 'plan.meal.swap', 'Meal', meal.id, { alternativeType });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // أي خطأ أثناء العملية كلها → 500.
    const msg = err instanceof Error ? err.message : 'تعذر استبدال الوجبة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
