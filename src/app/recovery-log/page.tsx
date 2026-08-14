/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/recovery-log/page.tsx

وظيفة الملف:
صفحة "النوم والاستشفاء" (المسار /recovery-log) — تجهز
بيانات هدف المستخدم ثم تعرض مكوّن DailyLog بنوع recovery
لتسجيل النوم والاستشفاء والاستعداد والوجبات الجاهزة.

لماذا نحتاجه؟
الاستشفاء جزء أساسي من أداء السباح؛ تسجيل النوم يظهر
في لوحة التحكم والتقارير.

نوعها: Server Component (بدون 'use client').
نقرأ هدف السعرات من قاعدة البيانات في الخادم قبل العرض.

متى يعمل؟
عند فتح /recovery-log بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- DailyLog من components/logs/daily-log.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب آخر حساب احتياجات (السعرات فقط لعرضها).
3. عرض DailyLog بنوع recovery.
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
export const metadata = { title: 'النوم والاستشفاء' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// RecoveryLogPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function RecoveryLogPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب آخر حساب احتياجات — نأخذ السعرات فقط
  // (المكوّن قد يعرض الهدف المقابل عند تسجيل "استعداد للتغذية").
  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true },
  });

  // الخطوة 3: عرض المكوّن الموحد بنوع recovery.
  // targets قد يكون null لو لم يحسب الاحتياجات بعد — المكوّن يتعامل مع هذا.
  return (
    <AppShell user={user}>
      <DailyLog type="recovery" user={user} targets={targets} />
    </AppShell>
  );
}
