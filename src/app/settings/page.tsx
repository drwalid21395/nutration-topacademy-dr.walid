/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/settings/page.tsx

وظيفة الملف:
صفحة "الإعدادات" (المسار /settings) — تعرض مكوّن
تخصيص الإشعارات (NotificationPrefs) وبطاقة معلومات
الحساب (اسم، بريد، دور، آخر دخول) وملاحظة عن تثبيت PWA.

لماذا نحتاجه؟
ليتحكم المستخدم في إشعاراته ويرى بيانات حسابه في مكان
واحد دون لوحة معقدة.

نوعها: Server Component (بدون 'use client').
نقرأ معلومات الحساب من قاعدة البيانات في الخادم قبل
إرسال الصفحة (تفضيلات الإشعارات نفسها Client عبر المكوّن).

متى يعمل؟
عند فتح /settings بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell + مكونات UI (Card, Badge).
- NotificationPrefs من components/settings/notification-prefs.
- formatDate من lib/utils و ROLES من lib/constants.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب سطر المستخدم من قاعدة البيانات.
3. عرض مكوّن الإشعارات + بطاقة معلومات الحساب + ملاحظة PWA.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { NotificationPrefs } from '@/components/settings/notification-prefs'; // مكوّن تفضيلات الإشعارات — ملف محلي.
import { Card, Badge } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.
import { formatDate } from '@/lib/utils'; // دالة تنسيق التواريخ — ملف محلي.
import { ROLES } from '@/lib/constants'; // أسماء الأدوار العربية — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'الإعدادات' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

// SettingsPage: الدالة الرئيسية للصفحة (تعمل في الخادم).
export default async function SettingsPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب سطر المستخدم الكامل من قاعدة البيانات
  // (لنعرض معلوماته المحدثة مباشرة من الجدول).
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">الإعدادات</h1>
        <p className="mt-1 text-sm text-slate-500">إعدادات الإشعارات وتفضيلات الحساب.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* العمود الرئيسي: تفضيلات الإشعارات (المكوّن يدير نفسه بنفسه). */}
        <div className="space-y-5 lg:col-span-2">
          <NotificationPrefs />
        </div>
        {/* الشريط الجانبي: معلومات الحساب + ملاحظة PWA */}
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">معلومات الحساب</h2>
            <div className="space-y-2 text-sm">
              {/* كل صف: عنوان وقيمة. dbUser?.name ?? '—' تعني: لو لا قيمة نعرض شرطة. */}
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">الاسم</span>
                <span className="font-bold text-slate-800">{dbUser?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">البريد</span>
                <span className="font-bold text-slate-800">{dbUser?.email ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-500">الدور</span>
                {/* تحويل مفتاح الدور إلى اسمه العربي عبر ROLES. */}
                <Badge color="ocean">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">آخر دخول</span>
                <span className="font-bold text-slate-800">{dbUser?.lastLoginAt ? formatDate(dbUser.lastLoginAt) : '—'}</span>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-bold text-ocean-900">ملاحظة PWA</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              لتلقي إشعارات Push، ثبّت التطبيق من المتصفح (رمز التثبيت في شريط العنوان) وفعّل الإشعارات في إعدادات التطبيق والمتصفح.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
