/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/swimmer-profile/page.tsx

وظيفة الملف:
صفحة "ملف السباح" (المسار /swimmer-profile) — تجلب ملف
السباح الحالي من قاعدة البيانات، تحوّله إلى بنية نموذج
(SwimmerFormData)، ثم تعرض نموذج SwimmerProfileForm
لتعبئة البيانات أو تعديلها.

لماذا نحتاجه؟
ملف السباح هو قلب النظام: كل الحسابات والخطط مبنية على
بياناته (الطول، الوزن، التدريب، الحالة الصحية...).

نوعها: Server Component (بدون 'use client').
نقرأ الملف الحالي من قاعدة البيانات في الخادم قبل إرسال
الصفحة، ثم نسلمه للنموذج (الذي يعمل في المتصفح).

متى يعمل؟
عند فتح /swimmer-profile بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من زر "تعديل
البيانات" في لوحة التحكم أو رسائل البيانات الناقصة.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell + مكونات UI (Card).
- SwimmerProfileForm من components/profile/swimmer-profile-form.
- SwimmerFormData من types.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب آخر ملف سباح من قاعدة البيانات.
3. تحويل قيم قاعدة البيانات إلى بنية النموذج (وتاريخ الميلاد كنص).
4. فك بيانات ولي الأمر (JSON) لو وُجدت.
5. عرض النموذج مع القيم الأولية.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { SwimmerProfileForm } from '@/components/profile/swimmer-profile-form'; // نموذج إدخال/تعديل ملف السباح — ملف محلي.
import { Card } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.

// ملاحظة:
// يبدو أن المكوّن Card مستورد هنا لكنه غير مستخدم حاليًا في هذا الملف.
// يجب التأكد قبل حذفه.
import type { SwimmerFormData } from '@/types'; // النوع الذي يعرّف بنية النموذج — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'ملف السباح' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// SwimmerProfilePage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function SwimmerProfilePage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب آخر ملف سباح للمستخدم (قد يكون null لو جديد).
  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  // الخطوة 3: تحويل بيانات قاعدة البيانات إلى بنية النموذج.
  // الحقول الاختيارية الفارغة نحولها إلى undefined (النموذج يتعامل معها كفارغة).
  // toISOString().slice(0,10): تحويل التاريخ إلى "YYYY-MM-DD" نصًا (حقل date في HTML).
  const initial: SwimmerFormData | null = profile
    ? {
        fullName: profile.fullName,
        gender: profile.gender,
        birthDate: profile.birthDate?.toISOString().slice(0, 10),
        heightCm: profile.heightCm ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        targetWeightKg: profile.targetWeightKg ?? undefined,
        bodyFatPercent: profile.bodyFatPercent ?? undefined,
        waistCm: profile.waistCm ?? undefined,
        country: profile.country ?? undefined,
        timezone: profile.timezone ?? undefined,
        ageGroup: profile.ageGroup ?? undefined,
        swimmerLevel: profile.swimmerLevel ?? undefined,
        specialty: profile.specialty ?? undefined,
        mainDistances: profile.mainDistances ?? undefined,
        personalBests: profile.personalBests ?? undefined,
        nextCompetitionDate: profile.nextCompetitionDate?.toISOString().slice(0, 10),
        swimSessionsPerWeek: profile.swimSessionsPerWeek ?? undefined,
        swimMinutesPerSession: profile.swimMinutesPerSession ?? undefined,
        trainingIntensity: profile.trainingIntensity ?? undefined,
        swimDistancePerSession: profile.swimDistancePerSession ?? undefined,
        gymSessionsPerWeek: profile.gymSessionsPerWeek ?? undefined,
        gymMinutesPerSession: profile.gymMinutesPerSession ?? undefined,
        gymType: profile.gymType ?? undefined,
        restDays: profile.restDays ?? undefined,
        trainingTime: profile.trainingTime ?? undefined,
        hasDoubleTraining: profile.hasDoubleTraining,
        sleepHours: profile.sleepHours ?? undefined,
        dailyActivityLevel: profile.dailyActivityLevel ?? undefined,
        goal: profile.goal ?? undefined,
        allergies: profile.allergies ?? undefined,
        dislikedFoods: profile.dislikedFoods ?? undefined,
        dietType: profile.dietType ?? undefined,
        preferredMealsPerDay: profile.preferredMealsPerDay ?? undefined,
        budgetLevel: profile.budgetLevel ?? undefined,
        availableFoods: profile.availableFoods ?? undefined,
        chronicConditions: profile.chronicConditions ?? undefined,
        medications: profile.medications ?? undefined,
        currentInjuries: profile.currentInjuries ?? undefined,
        digestiveIssues: profile.digestiveIssues ?? undefined,
        pregnancyStatus: profile.pregnancyStatus ?? undefined,
        isMinor: profile.isMinor,
        // بيانات ولي الأمر محفوظة كنص JSON داخل حقل واحد —
        // نفكها ونأخذ الاسم. JSON.parse قد يفشل لو النص تالف، لكن
        // البيانات تُكتب بحكم النظام فالمسار آمن عمليًا.
        guardianName: profile.guardianData
          ? (JSON.parse(profile.guardianData) as { name?: string }).name
          : undefined,
        guardianPhone: profile.guardianData
          ? (JSON.parse(profile.guardianData) as { phone?: string }).phone
          : undefined,
        notes: profile.notes ?? undefined,
      }
    : null;

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">ملف السباح</h1>
        <p className="mt-1 text-sm text-slate-500">
          أدخل بيانات السباح الأساسية والتدريبية والغذائية — تُستخدم لاحقًا في حساب الاحتياجات وإنشاء الخطط.
        </p>
      </div>
      {/* النموذج: initial تحمل القيم المحفوظة (أو null لو جديد)،
          ونتفاعل معه بصورة وصورة المستخدم واسمه. */}
      <SwimmerProfileForm initial={initial} userImage={user.image ?? null} userName={user.name ?? null} />
    </AppShell>
  );
}
