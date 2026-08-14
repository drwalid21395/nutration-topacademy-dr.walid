/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/plan/route.ts

وظيفة الملف:
واجهة API بحرف POST تُنشئ خطة غذائية كاملة للسباح:
تحدد مدة الخطة حسب النوع المختار، وتأخذ الأهداف المحسوبة
(من جدول NutritionTargets)، ثم تُنشئ كل الوجبات عبر
createPlanFromTargets وتعود بمعرّف الخطة الجديدة.

لماذا نحتاجه؟
زر "إنشاء الخطة الغذائية" في صفحة الخطط يستدعي هذا الملف
ليولّد الخطة تلقائيًا (أيام ووجبات وأطعمة) بناءً على
ملف السباح وأهدافه المحسوبة سابقًا.

متى يعمل؟
عند وصول طلب POST إلى /api/plan.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نقرأ نوع الخطة ونحدد مدتها من PLAN_DURATIONS.
4. نتأكد من وجود ملف السباح → 422 لو لا يوجد.
5. نحدد الأهداف (targetsId): مرسل أو أحدث سجل محفوظ → 422 لو لا يوجد.
6. نستدعي createPlanFromTargets لإنشاء الخطة كاملة.
7. نسجل العملية (audit) ونرجع معرّف الخطة.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: ملف/أهداف ناقصة.
- 429: طلبات كثيرة. 500: فشل في الإنشاء.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- createPlanFromTargets من services/plan/service.
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
// createPlanFromTargets: من services/plan/service — الدالة الرئيسية
// التي تبني الخطة كاملة (أيام ووجبات) من الأهداف الغذائية.
import { createPlanFromTargets } from '@/services/plan/service';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. الثوابت
// ========================================

// PLAN_DURATIONS: خريطة (Record) تربط كل نوع خطة بعدد أيامها.
// مثال: week = 7 أيام، thirtyDays = 30 يومًا.
const PLAN_DURATIONS: Record<string, number> = {
  daily: 1,
  threeDays: 3,
  week: 7,
  twoWeeks: 14,
  thirtyDays: 30,
  competitionPrep: 7,
  competitionDay: 1,
  postCompetition: 3,
};

// maxDuration = 60: رفع مهلة التنفيذ إلى 60 ثانية — إنشاء خطة
// من 30 يومًا يحتاج حفظًا مجمّعًا قد يتجاوز المهلة الافتراضية.
// الخطط الطويلة (30 يومًا) تحتاج مهلة أطول عند الحفظ المجمّع على قاعدة الإنتاج.
export const maxDuration = 60;

// ========================================
// 3. معالج الطلب POST (إنشاء الخطة)
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/plan.
// req: كائن الطلب الواصل (يحوي نوع الخطة ومعرّف الأهداف اختياريًا).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 20 طلبًا في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`plan:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  let body: { targetsId?: string; planType?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // planType: نوع الخطة (الافتراضي week = أسبوع).
  // durationDays: عدد الأيام من الخريطة (الافتراضي 7).
  const planType = body.planType ?? 'week';
  const durationDays = PLAN_DURATIONS[planType] ?? 7;

  // الخطوة 4: نتأكد من وجود ملف السباح — الخطة مبنية على بياناته.
  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'أدخل ملف السباح أولًا' }, { status: 422 });

  // الخطوة 5: تحديد الأهداف الغذائية.
  // إما أن يرسل المستخدم targetsId، أو نأخذ أحدث سجل أهداف له.
  let targetsId = body.targetsId;
  if (!targetsId) {
    const last = await prisma.nutritionTargets.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    // لو لا توجد أهداف محسوبة بعد → نطلب حسابها أولًا.
    if (!last) return NextResponse.json({ error: 'احسب الاحتياجات أولًا' }, { status: 422 });
    targetsId = last.id;
  }

  // الخطوة 6: إنشاء الخطة الفعلية.
  try {
    // createPlanFromTargets: تبني كل الأيام والوجبات وتعيد معرّف الخطة.
    // isCompetition: خطط البطولة لها خيارات خاصة.
    const { planId } = await createPlanFromTargets({
      userId: user.id,
      profileId: profile.id,
      targetsId,
      durationDays,
      planType,
      goal: profile.goal ?? undefined,
      isCompetition: planType === 'competitionPrep' || planType === 'competitionDay',
    });

    // الخطوة 7: تسجيل العملية في سجل التدقيق.
    await audit(user.id, 'plan.create', 'MealPlan', planId, { planType, durationDays });

    return NextResponse.json({ ok: true, planId, message: 'تم إنشاء الخطة الغذائية بنجاح' });
  } catch (err) {
    // أي خطأ أثناء الإنشاء → 500 مع رسالة الخطأ.
    const msg = err instanceof Error ? err.message : 'تعذر إنشاء الخطة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
