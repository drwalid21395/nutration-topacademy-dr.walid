/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/calculator/route.ts

وظيفة الملف:
واجهة API (Route) بحرف POST تُحسب الاحتياجات الغذائية
للسبحاح من ملفه المحفوظ، وتحفظ النتيجة في جدول
NutritionTargets، وترجع ملخصًا كاملًا للواجهة.

لماذا نحتاجه؟
صفحة الحاسبة (src/app/calculator/page.tsx) ترسل طلبًا هنا
ليحسب الخادم بالقيم العلمية ثم يعرض النتائج.

متى يعمل؟
عند استقبال طلب POST إلى /api/calculator.
(المسار في الملفات هو من "تسمية الـ API" — لا نكتب get/post في الرابط)

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نجلب ملف السباح من قاعدة البيانات.
4. لو لا يوجد ملف أو بيانات ناقصة → 422.
5. نحسب عبر summarizeNutrition (من services/nutrition).
6. نحفظ النتيجة في جدول NutritionTargets.
7. نسجل العملية (audit).
8. نرجع JSON للصفحة.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل. 422: بيانات ناقصة.
- 429: طلبات كثيرة (Rate Limit).

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- summarizeNutrition من services/nutrition.
- rateLimit + audit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { summarizeNutrition } from '@/services/nutrition';
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. معالج الطلب
// ========================================

/**
 * POST: حساب الاحتياجات من ملف السباح المحفوظ (أو من بيانات مرسلة).
 * يحفظ النتائج في NutritionTargets ويعيد الملخص كاملًا.
 */
// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST لهذا المسار.
// req: كائن الطلب الواصل.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  // لو غير مسجل → نرجع 401 مع رسالة JSON.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع إرسال أكثر من 30 طلبًا في الدقيقة لنفس المستخدم.
  // x-forwarded-for: عنوان IP القادم من بروكسي (معلومات إضافية).
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`calc:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: نجلب ملف السباح (أول ملف لهذا المستخدم).
  // findFirst: أول سجل يطابق الشرط.
  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
  });

  // لو لا يوجد ملف → نطلب منه إدخال بيانات السباح أولًا.
  if (!profile) {
    return NextResponse.json({ error: 'أدخل بيانات السباح أولًا' }, { status: 422 });
  }

  // الخطوة 4: نفحص أن الحقول الأساسية موجودة.
  // required: قائمة بالقيم. some(): هل واحدة منها فارغة؟
  const required = [profile.gender, profile.age, profile.heightCm, profile.weightKg];
  if (required.some((v) => v === null || v === undefined)) {
    return NextResponse.json(
      { error: 'أكمل البيانات الأساسية: الجنس والعمر والطول والوزن' },
      { status: 422 }
    );
  }

  // الخطوة 5: الحساب العلمي — نمرر بيانات الملف للدالة
  // التي تجري المعادلات وتوصي بالنصائح وتُصدر التنبيهات الطبية.
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

  // الخطوة 6: حفظ النتيجة في جدول NutritionTargets.
  // JSON.stringify: بعض النتائج كائنات (مثل mealCalories) —
  // نخزنها كنص JSON لأن العمود نصي في قاعدة البيانات.
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

  // الخطوة 7: تسجيل العملية في سجل التدقيق (سجلات سحابية تتبع من فعل ماذا).
  await audit(user.id, 'nutrition.calculate', 'NutritionTargets', targets.id);

  // الخطوة 8: إرسال النتيجة JSON للواجهة.
  return NextResponse.json({
    ok: true,
    targetsId: targets.id,
    result: summary.result,
    recommendations: summary.recommendations,
    alerts: summary.alerts,
  });
}
