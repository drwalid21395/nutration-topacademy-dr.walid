/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/my-profile/page.tsx

وظيفة الملف:
صفحة "ملخص بياناتي" (المسار /my-profile) — تعرض ملخصًا
كاملًا لملف السباح: بياناته، حساباته الغذائية، خطته،
الوزن، ومجاميع الأسبوع (ماء/وجبات/تمارين). وتتيح للمشرف
عرض ملخص أي سباح عبر ?userId=.

لماذا نحتاجه؟
ملف السباح مبعثر في عدة جداول؛ هذه الصفحة تجمع كل شيء
في نظرة واحدة للمستخدم وللدكتور.

نوعها: Server Component (بدون 'use client').
تقرأ من عدة جداول في الخادم قبل إرسال الصفحة — بيانات
حساسة لا تُرسل للمتصفح إلا بعد التحقق.

متى يعمل؟
عند فتح /my-profile بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية، والمشرف من زر "ملخص البيانات" في صفحة السباح.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- ProfileSummary من components/profile/profile-summary.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. تحديد المستخدم المعروض (نفسه، أو سباح معيّن لو مشرف).
3. جلب بياناته من 8 جداول بالتوازي (Promise.all).
4. فك بيانات ولي الأمر (JSON) لعرضها.
5. تمرير كل شيء لمكوّن ProfileSummary.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { ProfileSummary } from '@/components/profile/profile-summary'; // مكوّن عرض ملخص البيانات — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'ملخص بياناتي' };

// ========================================
// 3. الثوابت
// ========================================

// DAYS_MS: عدد المللي ثانية في يوم واحد (للحسابات الزمنية).
const DAYS_MS = 24 * 60 * 60 * 1000;

// ========================================
// 4. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// MyProfilePage: الدالة الرئيسية للصفحة (تعمل في الخادم).
// searchParams: معلمات الرابط — قد تأتي userId ليطلب المشرف عرض سباح آخر.
export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  // الخطوة 2: تحديد من نعرض بياناته.
  // الافتراضي: المستخدم نفسه.
  let targetUserId = user.id;
  let isOwn = true;
  // لو المستخدم مشرف وأرسل ?userId= لسباح آخر:
  if (user.role === 'admin' && sp.userId && sp.userId !== user.id) {
    // نتأكد أن هذا المعرّف لسباح (دوره athlete فعلًا).
    const target = await prisma.user.findUnique({
      where: { id: sp.userId },
      select: { id: true, role: true },
    });
    // لو سباحًا حقيقيًا → نعرض بياناته ونعتبرها "ليست لنفسي".
    if (target && target.role === 'athlete') {
      targetUserId = target.id;
      isOwn = false;
    }
  }

  // بداية الأسبوع: قبل 6 أيام من الآن.
  const weekStart = new Date(Date.now() - 6 * DAYS_MS);

  // الخطوة 3: جلب 8 مجموعات بيانات بالتوازي (Promise.all).
  const [userRow, profile, targets, plan, weights, waterAgg, foodAgg, trainingAgg] = await Promise.all([
    // أ- سطر المستخدم الأساسي (اسم، بريد، صورة، دور...).
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, image: true, role: true, status: true, createdAt: true },
    }),
    // ب- آخر ملف سباح.
    prisma.swimmerProfile.findFirst({
      where: { userId: targetUserId },
      orderBy: { updatedAt: 'desc' },
    }),
    // ج- آخر حساب احتياجات غذائية (أرقامه فقط).
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: targetUserId } },
      orderBy: { createdAt: 'desc' },
      select: {
        bmi: true,
        bmiCategory: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        waterMl: true,
        tdee: true,
      },
    }),
    // د- آخر خطة غذائية (ملخصها).
    prisma.mealPlan.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, planType: true, isActive: true, createdAt: true },
    }),
    // هـ- آخر 5 قياسات وزن.
    prisma.weightLogEntry.findMany({
      where: { userId: targetUserId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { date: true, weightKg: true },
    }),
    // و- مجموع الماء في الأسبوع (aggregate: يجمع في الخادم بدل جلب كل السجلات).
    prisma.waterLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _sum: { amountMl: true },
    }),
    // ز- عدد الوجبات ومجموع سعراتها في الأسبوع.
    prisma.foodLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _count: { _all: true },
      _sum: { calories: true },
    }),
    // ح- عدد التمارين ومجموع مدتها في الأسبوع.
    prisma.trainingLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _count: { _all: true },
      _sum: { durationMin: true },
    }),
  ]);

  // لو المستخدم غير موجود أو محذوف → نعيده للوحة (حماية).
  if (!userRow || userRow.status === 'deleted') redirect('/dashboard');

  // الخطوة 4: فك بيانات ولي الأمر.
  // في قاعدة البيانات بيانات ولي الأمر محفوظة كنص JSON داخل حقل واحد.
  let guardianName: string | null = null;
  let guardianPhone: string | null = null;
  if (profile?.guardianData) {
    try {
      // JSON.parse: تحويل النص إلى كائن. قد يفشل لو النص تالف → نمسك الخطأ.
      const g = JSON.parse(profile.guardianData) as { name?: string; phone?: string };
      guardianName = g.name ?? null;
      guardianPhone = g.phone ?? null;
    } catch {
      // تجاهل بيانات غير صالحة
    }
  }

  // ========================================
  // 5. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      {/* لو يعرض المشرف سباحًا آخر: نضع عنوانًا مميزًا "ملخص السباح". */}
      {!isOwn && (
        <div className="mb-6">
          <h1 className="text-2xl font-black text-ocean-900">ملخص السباح</h1>
          <p className="mt-1 text-sm text-slate-500">جميع بيانات السباح وملخص حالته في صفحة واحدة — كعرض للدكتور.</p>
        </div>
      )}
      {/* نمرر كل البيانات المجهزة لمكوّن العرض.
          user/profile/targets/plan: تمرير الحقول الجاهزة مع قيم افتراضية null. */}
      <ProfileSummary
        user={{
          name: userRow.name,
          email: userRow.email,
          image: userRow.image,
          role: userRow.role,
          createdAt: userRow.createdAt,
        }}
        profile={
          profile
            ? {
                fullName: profile.fullName,
                gender: profile.gender,
                birthDate: profile.birthDate,
                heightCm: profile.heightCm,
                weightKg: profile.weightKg,
                targetWeightKg: profile.targetWeightKg,
                bodyFatPercent: profile.bodyFatPercent,
                waistCm: profile.waistCm,
                country: profile.country,
                timezone: profile.timezone,
                ageGroup: profile.ageGroup,
                swimmerLevel: profile.swimmerLevel,
                specialty: profile.specialty,
                mainDistances: profile.mainDistances,
                personalBests: profile.personalBests,
                nextCompetitionDate: profile.nextCompetitionDate,
                swimSessionsPerWeek: profile.swimSessionsPerWeek,
                swimMinutesPerSession: profile.swimMinutesPerSession,
                trainingIntensity: profile.trainingIntensity,
                swimDistancePerSession: profile.swimDistancePerSession,
                gymSessionsPerWeek: profile.gymSessionsPerWeek,
                gymMinutesPerSession: profile.gymMinutesPerSession,
                gymType: profile.gymType,
                restDays: profile.restDays,
                trainingTime: profile.trainingTime,
                hasDoubleTraining: profile.hasDoubleTraining,
                sleepHours: profile.sleepHours,
                dailyActivityLevel: profile.dailyActivityLevel,
                goal: profile.goal,
                allergies: profile.allergies,
                dislikedFoods: profile.dislikedFoods,
                dietType: profile.dietType,
                preferredMealsPerDay: profile.preferredMealsPerDay,
                budgetLevel: profile.budgetLevel,
                availableFoods: profile.availableFoods,
                chronicConditions: profile.chronicConditions,
                medications: profile.medications,
                currentInjuries: profile.currentInjuries,
                digestiveIssues: profile.digestiveIssues,
                pregnancyStatus: profile.pregnancyStatus,
                isMinor: profile.isMinor,
                guardianName,
                guardianPhone,
                notes: profile.notes,
                medicalAlert: profile.medicalAlert,
              }
            : null
        }
        targets={
          targets
            ? {
                bmi: targets.bmi,
                bmiCategory: targets.bmiCategory,
                calories: targets.calories,
                proteinG: targets.proteinG,
                carbsG: targets.carbsG,
                fatG: targets.fatG,
                waterMl: targets.waterMl,
                tdee: targets.tdee,
              }
            : null
        }
        plan={
          plan
            ? { title: plan.title, planType: plan.planType, isActive: plan.isActive, createdAt: plan.createdAt }
            : null
        }
        weights={weights}
        /* مجاميع الأسبوع: القيم المجمعة من aggregate.
           ?? 0: لو لا توجد قيم نستخدم صفرًا. */
        week={{
          waterMl: waterAgg._sum.amountMl ?? 0,
          foodCount: foodAgg._count._all,
          foodCalories: foodAgg._sum.calories ?? 0,
          trainingCount: trainingAgg._count._all,
          trainingMin: trainingAgg._sum.durationMin ?? 0,
        }}
        isOwn={isOwn}
      />
    </AppShell>
  );
}
