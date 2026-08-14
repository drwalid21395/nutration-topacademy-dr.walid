/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/competition-mode/page.tsx

وظيفة الملف:
صفحة "وضع البطولة" (المسار /competition-mode) — تتحقق
من تسجيل الدخول، تجلب بعض بيانات ملف السباح، ثم تسلمها
للمكون CompetitionMode الذي يبني خطط الاستعداد للبطولة.

لماذا نحتاجه؟
حتى يقرأ الخادم بيانات السباح (هل أدخل ملفه؟ هل قاصر؟
تاريخ البطولة القادمة) قبل عرض المكون، لأن هذه المعلومات
تتحكم في ما يظهر داخل المكون.

نوعها: Server Component (بدون 'use client').
تعمل في الخادم وتقرأ قاعدة البيانات قبل إرسال الصفحة.

متى يعمل؟
عند فتح /competition-mode بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من بطاقة
"وضع الاستعداد للبطولة" في لوحة التحكم.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell من components/layout/app-shell.
- CompetitionMode من components/competition/competition-mode.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب ملف السباح من قاعدة البيانات.
3. تمرير معلومات قليلة للمكون (هل الملف موجود، هل قاصر، الاسم، تاريخ البطولة).
4. المكون يبني واجهة الاستعداد.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { CompetitionMode } from '@/components/competition/competition-mode'; // مكون واجهة وضع البطولة — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'وضع البطولة' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// CompetitionModePage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function CompetitionModePage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: جلب ملف السباح (قد يكون null لو لم يُدخل بياناته بعد).
  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });

  // الخطوة 3: عرض المكون مع المعلومات الجاهزة:
  // - hasProfile: هل أدخل المستخدم ملفه؟ (يحدد رسالة داخل المكون)
  // - isMinor: هل هو قاصر؟ (يمنع خططًا تفصيلية ويحول للاستشارة)
  // - profileName: اسم السباح لعرضه.
  // - nextCompetitionDate: تاريخ البطولة القادمة كنص (أو null).
  //   toISOString: تحويل التاريخ إلى نص معياري يسهل تمريره للمتصفح.
  return (
    <AppShell user={user}>
      <CompetitionMode
        hasProfile={!!profile}
        isMinor={profile?.isMinor ?? false}
        profileName={profile?.fullName ?? null}
        nextCompetitionDate={profile?.nextCompetitionDate?.toISOString() ?? null}
      />
    </AppShell>
  );
}
