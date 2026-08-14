/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/water-log/page.tsx

وظيفة الملف:
صفحة "سجل الماء" (المسار /water-log) — تجلب هدف الماء
اليومي من قاعدة البيانات ثم تعرض مكوّن DailyLog بالإعداد
type="water" لتسجيل أكواب الماء ومتابعة الترطيب.

لماذا نحتاجه؟
الترطيب أساسي لأداء السباح؛ سجل الماء جزء من المتابعة
اليومية والتقارير.

نوعها: Server Component (بدون 'use client').
نقرأ الهدف من قاعدة البيانات في الخادم قبل إرسال الصفحة.

متى يعمل؟
عند فتح /water-log بعد تسجيل الدخول (من القائمة الجانبية).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- DailyLog من components/logs/daily-log.

ترتيب العمل:
1. فحص تسجيل الدخول (لو زائر → صفحة الدخول).
2. جلب آخر حساب احتياجات (الماء waterMl فقط).
3. عرض مكوّن السجل بنوع water.
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
export const metadata = { title: 'سجل الماء' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// WaterLogPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function WaterLogPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب آخر حساب احتياجات — هدف الماء (waterMl) فقط.
  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { waterMl: true }, // نقرأ حقل الماء — لا حاجة لبقية الحقول.
  });

  // الخطوة 3: عرض المكوّن — type="water" تجعل المكوّن يعرف حقول الماء.
  return (
    <AppShell user={user}>
      <DailyLog type="water" user={user} targets={targets} />
    </AppShell>
  );
}
