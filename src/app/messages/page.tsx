/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/messages/page.tsx

وظيفة الملف:
صفحة "الرسائل" (المسار /messages) — صفحة رقيقة تتحقق
من تسجيل الدخول، تقرأ معرّف المرسل إليه الاختياري من
الرابط (إن وُجد)، ثم تعرض مكون MessagesView.

لماذا نحتاجه؟
مكوّن الرسائل كله Client (يعمل في المتصفح ويتصل بالخادم
بشكل متزامن)، لكن الصفحة نفسها Server لفحص تسجيل الدخول
ولقراءة معرّف المستخدم من رابط التوجيه.

نوعها: Server Component (بدون 'use client').
تفحص في الخادم قبل إرسال الصفحة.

متى يعمل؟
عند فتح /messages بعد تسجيل الدخول، أو فتح
/messages?userId=<معرف> من صفحة مشرف.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية، والمشرف من زر "مراسلة" في صفحة السباح.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- AppShell من components/layout/app-shell.
- MessagesView من components/messages/messages-view (المكوّن الفعلي).

ترتيب العمل:
1. فحص تسجيل الدخول.
2. قراءة userId من المعلمات (إن وُجد) — ليبدأ المحادثة معه.
3. تمرير معرّفي المستخدم ودوره لـ MessagesView.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { MessagesView } from '@/components/messages/messages-view'; // واجهة المحادثات الفعلية — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'الرسائل' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// MessagesPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
// searchParams: معلمات الرابط (بعد علامة ?). في Next.js 15 هي Promise
// فنتنتظرها بـ await. هنا قد تأتي userId لبدء محادثة مباشرة.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // الخطوة 2: قراءة معلمات الرابط (sp اختصار searchParams).
  const sp = await searchParams;

  // الخطوة 3: عرض مكون الرسائل مع:
  // - myId: معرّف المستخدم الحالي (طرف المحادثة الأول).
  // - myRole: دوره (يتحكم بمن يستطيع المراسلة).
  // - initialUserId: معرّف الطرف الآخر إن جاء في الرابط (مثل من صفحة المشرف).
  return (
    <AppShell user={user}>
      <MessagesView myId={user.id} myRole={user.role} initialUserId={sp.userId} />
    </AppShell>
  );
}
