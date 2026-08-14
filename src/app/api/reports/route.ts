/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/reports/route.ts

وظيفة الملف:
واجهة API بحرف GET تجمع تقريرًا غذائيًا كاملًا للسباح:
المجموعات اليومية (سعرات/بروتين/كربوهيدرات/دهون/ماء)،
التدريبات، النوم، الوزن، الالتزام اليومي، وأحدث خطة غذائية.

لماذا نحتاجه؟
صفحة "تقريري" أو لوحة السباح تعرض كل الأرقام في رسوم
وجداول — هذا الملف يجمّع كل البيانات من عدة جداول دفعة واحدة.

متى يعمل؟
عند وصول طلب GET إلى /api/reports?days=7 (الافتراضي 7 أيام،
بحد أقصى 90).

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. نحدد الفترة (days) ونحسب تاريخ البداية.
3. نجلب 8 استعلامات من قاعدة البيانات بالتوازي (Promise.all).
4. نحسب المجاميع والنسب (متوسط النوم، الالتزام، تغير الوزن).
5. نبني الرد الكامل (totals + dailyCalories + adherence).

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
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

// ========================================
// 2. معالج الطلب GET (بناء التقرير)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
// يدعم معامل ?days= لتحديد عدد أيام التقرير.
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: تحديد الفترة.
  // Math.min(..., 90): بحد أقصى 90 يومًا مهما طلب أكثر.
  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get('days') ?? 7), 90);
  // تاريخ البداية = الآن ناقص عدد الأيام، من منتصف الليل.
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  // الخطوة 3: جلب كل البيانات بالتوازي.
  // Promise.all: يشغّل 8 استعلامات معًا (أسرع بكثير من التسلسل).
  // من جدول SwimmerProfile: الملف الغذائي.
  // من NutritionTargets: الأهداف المحسوبة.
  // من FoodLogEntry/WaterLogEntry/TrainingLogEntry/
  // RecoveryLogEntry/WeightLogEntry: كل السجلات منذ البداية.
  // من MealPlan: أحدث خطة غذائية.
  const [profile, targets, food, water, training, recovery, weight, plan] = await Promise.all([
    prisma.swimmerProfile.findFirst({ where: { userId: user.id } }),
    prisma.nutritionTargets.findFirst({ where: { profile: { userId: user.id } }, orderBy: { createdAt: 'desc' } }),
    prisma.foodLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.waterLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.trainingLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.recoveryLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.weightLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
    prisma.mealPlan.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  // الخطوة 4: الحسابات.
  // sum: دالة مساعدة تجمع قيم حقل معين عبر قائمة السجلات.
  const sum = (arr: any[], k: string) => arr.reduce((a, i) => a + (Number(i[k]) || 0), 0);

  // متوسط ساعات النوم (مجموع الساعات ÷ عدد سجلات الاستشفاء).
  const avgSleep = recovery.length ? recovery.reduce((a, i) => a + (Number(i.sleepHours) || 0), 0) / recovery.length : 0;

  // نجمّع السعرات المستهلكة لكل يوم (Map: تاريخ ← سعرات).
  const dailyCalories: { date: string; consumed: number; target: number }[] = [];
  const byDate = new Map<string, { consumed: number }>();
  for (const f of food) {
    // نستخرج اليوم فقط (YYYY-MM-DD) من تاريخ السجل.
    const key = new Date(f.date).toISOString().slice(0, 10);
    byDate.set(key, { consumed: (byDate.get(key)?.consumed ?? 0) + (Number(f.calories) || 0) });
  }
  // نكمل كل يوم من الفترة (حتى الأيام بلا سجلات تظهر بصفر).
  for (let d = 0; d < days; d++) {
    const day = new Date(from);
    day.setDate(from.getDate() + d);
    const key = day.toISOString().slice(0, 10);
    dailyCalories.push({
      date: key,
      consumed: byDate.get(key)?.consumed ?? 0,
      target: Math.round(targets?.calories ?? 0),
    });
  }

  // نسبة الالتزام: الأيام التي فيها استهلاك قريب من الهدف
  // (فرق ≤ 15% من الهدف) مقسومة على إجمالي الأيام.
  const adherenceDays = dailyCalories.filter((d) => d.target > 0 && Math.abs(d.consumed - d.target) / d.target <= 0.15).length;
  const adherencePct = days > 0 ? Math.round((adherenceDays / days) * 100) : 0;

  // تغير الوزن: أول قراءة مقابل آخر قراءة في الفترة.
  const weightFirst = weight[0]?.weightKg ?? null;
  const weightLast = weight[weight.length - 1]?.weightKg ?? null;
  const weightChange = weightFirst != null && weightLast != null ? Math.round((weightLast - weightFirst) * 10) / 10 : null;

  // الخطوة 5: بناء الرد الكامل.
  // totals: مجاميع الفترة كلها.
  // swimMinutes/gymMinutes: دقائق السباحة واللياقة منفصلة.
  // plan: ملخص أحدث خطة غذائية (أو null).
  return NextResponse.json({
    days,
    profile,
    targets,
    totals: {
      calories: Math.round(sum(food, 'calories')),
      protein: Math.round(sum(food, 'proteinG')),
      carbs: Math.round(sum(food, 'carbsG')),
      fat: Math.round(sum(food, 'fatG')),
      water: Math.round(sum(water, 'amountMl')),
      sessions: training.length,
      swimMinutes: training.filter((t) => t.sessionType === 'swim').reduce((a, i) => a + (Number(i.durationMin) || 0), 0),
      gymMinutes: training.filter((t) => t.sessionType === 'gym').reduce((a, i) => a + (Number(i.durationMin) || 0), 0),
      avgSleep: Math.round(avgSleep * 10) / 10,
      weightChange,
      weightFirst,
      weightLast,
    },
    dailyCalories,
    adherencePct,
    plan: plan ? { id: plan.id, title: plan.title, totalCalories: plan.totalCalories } : null,
  });
}
