/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/training-log/page.tsx

وظيفة الملف:
صفحة "سجل التمارين" (المسار /training-log) — تجلب هدف
السعرات الحالي من قاعدة البيانات ثم تعرض مكوّن DailyLog
بالإعداد type="training" لتسجيل التمارين (السباحة والجيم)
اليومية وحساب السعرات المحروقة.

لماذا نحتاجه؟
تسجيل التمرين اليومي يغذي التقارير ولوحة المتابعة؛ كل نوع
سجل (طعام/ماء/وزن/تمارين) يستخدم نفس المكوّن مع نوع مختلف.

نوعها: Server Component (بدون 'use client').
نقرأ الهدف من قاعدة البيانات في الخادم قبل إرسال الصفحة.

متى يعمل؟
عند فتح /training-log بعد تسجيل الدخول (من القائمة الجانبية).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- DailyLog من components/logs/daily-log.

ترتيب العمل:
1. فحص تسجيل الدخول (لو زائر → صفحة الدخول).
2. جلب آخر حساب احتياجات (السعرات فقط).
3. عرض مكوّن السجل بنوع training.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { DailyLog } from '@/components/logs/daily-log'; // المكوّن الموحد لكل السجلات — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'سجل التمارين' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// TrainingLogPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function TrainingLogPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب آخر حساب احتياجات (هدف السعرات) من قاعدة البيانات.
  // profile يشير إلى ملف السباح الخاص بالمستخدم؛ نأخذ أحدث سجل (createdAt desc).
  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true }, // نقرأ السعرات فقط — لا حاجة لبقية الحقول.
  });

  // الخطوة 3: عرض المكوّن — يمرر له المستخدم ونوع السجل والهدف.
  // type="training" تجعل المكوّن يعرف الحقول المطلوبة للتمارين.
  return (
    <AppShell user={user}>
      <DailyLog type="training" user={user} targets={targets} />
    </AppShell>
  );
}
