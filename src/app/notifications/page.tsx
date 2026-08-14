/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/notifications/page.tsx

وظيفة الملف:
صفحة "الإشعارات" (المسار /notifications) — صفحة رقيقة:
تفحص تسجيل الدخول ثم تعرض مكوّن NotificationsList الذي
يجلب الإشعارات ويعرضها ويسمح بتحديدها كمقروءة.

لماذا نحتاجه؟
المكوّن الفعلي Client (يعمل في المتصفح ويجلب بياناته)،
فدور الصفحة هو الحماية والغلاف فقط.

نوعها: Server Component (بدون 'use client').
الفحص في الخادم قبل إرسال الصفحة.

متى يعمل؟
عند فتح /notifications بعد تسجيل الدخول (من رابط
"الكل" في لوحة التحكم أو القائمة الجانبية).

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- AppShell من components/layout/app-shell.
- NotificationsList من components/notifications/notifications-list.

ترتيب العمل:
1. فحص تسجيل الدخول (لو زائر → صفحة الدخول).
2. عرض مكوّن قائمة الإشعارات داخل الإطار العام.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { NotificationsList } from '@/components/notifications/notifications-list'; // مكوّن عرض الإشعارات — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'الإشعارات' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// NotificationsPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function NotificationsPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: عرض مكوّن الإشعارات (هو من يجلب البيانات ويعرضها).
  return (
    <AppShell user={user}>
      <NotificationsList />
    </AppShell>
  );
}
