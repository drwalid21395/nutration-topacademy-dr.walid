/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/food-log/page.tsx

وظيفة الملف:
صفحة "سجل الطعام" (المسار /food-log) — تجهز البيانات
اللازمة ثم تعرض مكون DailyLog من نوع الطعام: إضافة
الوجبات، عرض السعرات اليومية، المقارنة مع الهدف،
ومقارنة الخطة.

لماذا نحتاجه؟
سجلات الطعام هي أهم بيانات المتابعة اليومية؛ منها تُحسب
الالتزام بالسعرات في كل التقارير.

نوعها: Server Component (بدون 'use client').
نقرأ الهدف والخطة من قاعدة البيانات في الخادم قبل إرسال
الصفحة، فلا نحتاج جلبًا إضافيًا.

متى يعمل؟
عند فتح /food-log بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من زر
"سجل الطعام" في لوحة التحكم والقائمة الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- DailyLog من components/logs/daily-log (نفس المكون لبقية السجلات).

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب آخر حساب احتياجات + الخطة النشطة (بالتوازي).
3. تجهيز وجبات اليوم الأول من الخطة.
4. عرض مكون DailyLog (نوع: food) مع هذه البيانات.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { DailyLog, type LogType } from '@/components/logs/daily-log'; // المكوّن الموحد لكل السجلات + نوعه — ملف محلي.

// ملاحظة:
// يبدو أن النوع LogType مستورد هنا لكنه غير مستخدم مباشرة في هذا الملف.
// يجب التأكد قبل حذفه.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'سجل الطعام' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// FoodLogPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function FoodLogPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: جلب بياناتين معًا (Promise.all للتوازي):
  const [targets, activePlan] = await Promise.all([
    // أ- آخر حساب احتياجات (سعرات ومغذيات وماء) لعرض الأهداف.
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
    }),
    // ب- الخطة النشطة مع وجباتها وعناصرها (للمقارنة اليومية).
    prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
    }),
  ]);

  // الخطوة 3: وجبات اليوم = وجبات اليوم الأول فقط من الخطة
  // (نفس منهجية لوحة التحكم). filter: يصفّي الوجبات حسب رقم اليوم.
  // اليوم 1 هو اليوم الأول من الخطة.
  const todayMeals = activePlan?.meals?.filter((m) => m.dayNumber === 1) ?? [];

  // الخطوة 4: عرض المكون الموحد مع:
  // - type="food": يخبر المكون أنه يسجل وجبات.
  // - targets و todayMeals: الأهداف ووجبات اليوم للعرض والمقارنة.
  return (
    <AppShell user={user}>
      <DailyLog type="food" user={user} targets={targets} todayMeals={todayMeals} />
    </AppShell>
  );
}
