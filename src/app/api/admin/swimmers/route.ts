/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/admin/swimmers/route.ts

وظيفة الملف:
واجهة API بحرف GET تعرض قائمة السباحين للأدمن مع حالة
الالتزام الغذائي اليومي: بيانات كل سباح + خطته النشطة +
مجموع ما سجله اليوم (سعرات/بروتين/كربوهيدرات/دهون/ماء)
+ أيام تسجيله في آخر 7 أيام + نسب الالتزام بالخطة.

لماذا نحتاجه؟
لوحة إدارة الدكتور تعرض جدول السباحين مع مؤشر فوري
لمدى التزام كل واحد — وهذا الملف يجهّز كل هذه البيانات
في استجابة واحدة.

متى يعمل؟
عند وصول طلب GET إلى /api/admin/swimmers — للأدمن فقط.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401، ولو ليس أدمن → 403.
2. نجلب السباحين (غير المحذوفين) مع ملفهم وخطتهم وسجلات اليوم.
3. نحسب أيام تسجيل كل سباح في آخر 7 أيام.
4. نبني لكل سباح: بياناته + خطة + ملخص اليوم + نسب الالتزام.
5. نرجع القائمة { swimmers: [...] }.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل. 403: ليست لديك صلاحية.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- startOfToday من lib/utils.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextResponse: أداة Next.js لإرسال الرد إلى المتصفح.
// (لا نحتاج NextRequest هنا لأن الطلب لا يحوي معاملات.) من next/server.
import { NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// startOfToday: من lib/utils — دالة تعيد بداية اليوم الحالي (منتصف الليل).
import { startOfToday } from '@/lib/utils';

// (ملاحظة: التعليقات النصية العربية في هذا الملف تحمل ترميزًا
// تالفًا قديمًا — نتركها كما هي كما هو مطلوب، دون تغييرها.)
/**
 * ظ‚ط§ط¦ظ…ط© ط§ظ„ط³ط¨ط§ط­ظٹظ† ظ…ط¹ ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ ط§ظ„ظٹظˆظ…ظٹ ظ„ظ„ط£ط¯ظ…ظ†.
 * ظƒظ„ ط³ط¨ط§ط­: ط¨ظٹط§ظ†ط§طھظ‡ + ط®ط·طھظ‡ ط§ظ„ظ†ط´ط·ط© + ظ…ط¬ظ…ظˆط¹ ظ…ط§ ط³ط¬ظ„ظ‡ ط§ظ„ظٹظˆظ… (ط³ط¹ط±ط§طھ/ط¨ط±ظˆطھظٹظ†/ظƒط±ط¨ظˆظ‡ظٹط¯ط±ط§طھ/ط¯ظ‡ظˆظ†/ظ…ط§ط،)
 * + ط¹ط¯ط¯ ط£ظٹط§ظ… ط§ظ„طھط³ط¬ظٹظ„ ظپظٹ ط¢ط®ط± 7 ط£ظٹط§ظ… + ظ†ط³ط¨ ط§ظ„ط§ظ„طھط²ط§ظ….
 */

// ========================================
// 2. معالج الطلب GET (قائمة السباحين)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول + أن المستخدم أدمن.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ظ„ظٹط³طھ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط©' }, { status: 403 });

  // الخطوة 2: حدود الفترة — بداية اليوم الحالي وقبل 7 أيام
  // (نستخدمها لتحديد سجلات اليوم وأيام تسجيل الأسبوع).
  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // الخطوة 3: جلب كل السباحين غير المحذوفين (الأقدم أولًا)
  // مع ملفهم الشخصي الأحدث (take: 1) وخطتهم النشطة الأحدث
  // وسجلات اليوم: طعام، ماء، تدريبات.
  const swimmers = await prisma.user.findMany({
    where: { role: 'athlete', status: { not: 'deleted' } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      profiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { id: true, fullName: true, ageGroup: true, swimmerLevel: true, goal: true, weightKg: true },
      },
      mealPlans: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, title: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true, goal: true },
      },
      foodLogs: {
        where: { date: { gte: todayStart } },
        select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
      },
      waterLogs: {
        where: { date: { gte: todayStart } },
        select: { amountMl: true },
      },
      trainingLogs: {
        where: { date: { gte: todayStart } },
        select: { sessionType: true, durationMin: true, distanceM: true },
      },
    },
  });

  // ظ‚ظٹط§ظ… ط§ظ„طھط³ط¬ظٹظ„ ظپظٹ ط¢ط®ط± 7 ط£ظٹط§ظ… ظ„ظƒظ„ ط³ط¨ط§ط­
  // الخطوة 4: عدّ سجلات الطعام لكل سباح لكل يوم من آخر أسبوع.
  // (ملاحظة: هذا التعليق النصي تالف أيضًا — نتركه كما هو.)
  // groupBy: نجمع السجلات حسب (سباح + يوم).
  const foodLogDays = await prisma.foodLogEntry.groupBy({
    by: ['userId', 'date'],
    where: { date: { gte: weekAgo }, userId: { in: swimmers.map((s) => s.id) } },
    _count: { _all: true },
  });
  // daysPerUser: خريطة (سباح ← مجموعة أيام سجّل فيها طعامًا).
  // Set يمنع تكرار نفس اليوم.
  const daysPerUser = new Map<string, Set<string>>();
  for (const row of foodLogDays) {
    const dayKey = row.date.toISOString().slice(0, 10);
    if (!daysPerUser.has(row.userId)) daysPerUser.set(row.userId, new Set());
    daysPerUser.get(row.userId)!.add(dayKey);
  }

  // الخطوة 5: بناء صف لكل سباح.
  const rows = swimmers.map((s) => {
    const profile = s.profiles?.[0] ?? null; // أحدث ملف شخصي.
    const plan = s.mealPlans[0] ?? null; // أحدث خطة نشطة.

    // food: نجمّع سجلات اليوم (سعرات/بروتين/كربوهيدرات/دهون/ماء من الطعام).
    const food = s.foodLogs.reduce<{ calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number }>(
      (acc, e) => ({
        calories: acc.calories + (e.calories ?? 0),
        proteinG: acc.proteinG + (e.proteinG ?? 0),
        carbsG: acc.carbsG + (e.carbsG ?? 0),
        fatG: acc.fatG + (e.fatG ?? 0),
        waterMl: acc.waterMl + (e.waterMl ?? 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, waterMl: 0 }
    );
    // الماء الكلي = ماء الطعام + ماء المسجل مباشرة.
    const waterMl = food.waterMl + s.waterLogs.reduce((a, w) => a + w.amountMl, 0);

    // pct: نسبة الاستهلاك من الهدف (بحد أقصى 100%)، أو null لو لا هدف.
    const pct = (value: number, target: number | null | undefined) =>
      target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null;

    return {
      id: s.id,
      name: s.name,
      fullName: profile?.fullName ?? s.name,
      email: s.email,
      image: s.image,
      status: s.status,
      createdAt: s.createdAt,
      lastLoginAt: s.lastLoginAt,
      // بيانات الملف الشخصي (أو null لو لا ملف).
      profile: profile
        ? {
            ageGroup: profile.ageGroup ?? null,
            swimmerLevel: profile.swimmerLevel ?? null,
            goal: profile.goal ?? null,
            weightKg: profile.weightKg ?? null,
          }
        : null,
      // بيانات الخطة النشطة (أو null لو لا خطة).
      plan: plan
        ? {
            id: plan.id,
            title: plan.title,
            goal: plan.goal ?? null,
            calories: plan.totalCalories ?? null,
            proteinG: plan.proteinG ?? null,
            carbsG: plan.carbsG ?? null,
            fatG: plan.fatG ?? null,
            waterMl: plan.waterMl ?? null,
          }
        : null,
      // ملخص سجل اليوم: مجاميع + عدد الوجبات والتدريبات + وقت/مسافة التدريب.
      today: {
        calories: Math.round(food.calories),
        proteinG: Math.round(food.proteinG),
        carbsG: Math.round(food.carbsG),
        fatG: Math.round(food.fatG),
        waterMl: Math.round(waterMl),
        mealsCount: s.foodLogs.length,
        trainingsCount: s.trainingLogs.length,
        trainingMin: s.trainingLogs.reduce((a, t) => a + (t.durationMin ?? 0), 0),
        trainingDistance: s.trainingLogs.reduce((a, t) => a + (t.distanceM ?? 0), 0),
      },
      // نسب الالتزام: كم % حقق من أهداف خطته اليوم (أو null لو لا خطة).
      adherence: plan
        ? {
            calories: pct(food.calories, plan.totalCalories),
            protein: pct(food.proteinG, plan.proteinG),
            carbs: pct(food.carbsG, plan.carbsG),
            fat: pct(food.fatG, plan.fatG),
            water: pct(waterMl, plan.waterMl),
            overall: pct(
              food.calories,
              plan.totalCalories
            ),
          }
        : null,
      // عدد الأيام التي سجّل فيها طعامًا خلال آخر 7 أيام.
      activeDays7: daysPerUser.get(s.id)?.size ?? 0,
    };
  });

  // الخطوة 6: إرجاع القائمة كاملة.
  return NextResponse.json({ swimmers: rows });
}
