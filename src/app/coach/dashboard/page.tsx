/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/coach/dashboard/page.tsx

وظيفة الملف:
لوحة المدرب (المسار /coach/dashboard) — صفحة صغيرة
مهمتها فحص الصلاحيات فقط، ثم عرض مكون CoachDashboard
الذي يعرض سباحي المدرب وتقاريرهم ومراسلاتهم.

لماذا نحتاجه؟
يحافظ على خصوصية أدوار المدربين: لا يدخلها إلا من كان
دوره coach أو dietitian بعد تسجيل الدخول.

نوعها: Server Component (بدون 'use client').
الفحص يتم في الخادم، وهو الموضع الأأمن لحماية الصفحات.

متى يعمل؟
عند فتح /coach/dashboard من متصفح المدرب.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا، ويصل إليه المدرب من رابط
"لوحة المدرب" في القائمة الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- AppShell من components/layout/app-shell.
- CoachDashboard من components/coach/coach-dashboard (المحتوى الفعلي).

ترتيب العمل:
1. جلب المستخدم الحالي.
2. غير مسجل → صفحة الدخول.
3. الدور ليس coach أو dietitian → لوحة التحكم العادية.
4. عرض CoachDashboard مع تحديد هل المستخدم اختصاصي تغذية.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { CoachDashboard } from '@/components/coach/coach-dashboard'; // محتوى لوحة المدرب الفعلي — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'لوحة المدرب' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// CoachDashboardPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function CoachDashboardPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // الخطوة 2: لو الدور ليس مدربًا ولا اختصاصي تغذية → إلى اللوحة العادية.
  // includes: هل يوجد الدور داخل القائمة المسموح بها؟
  if (!['coach', 'dietitian'].includes(user.role)) redirect('/dashboard');

  // الخطوة 3: عرض لوحة المدرب.
  // isDietitian: true لو الدور اختصاصي تغذية (يظهر مزايا إضافية في اللوحة).
  return (
    <AppShell user={user}>
      <CoachDashboard isDietitian={user.role === 'dietitian'} />
    </AppShell>
  );
}
