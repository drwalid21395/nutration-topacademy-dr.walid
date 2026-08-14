/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/my-plans/page.tsx

وظيفة الملف:
صفحة "البرنامج الغذائي" (المسار /my-plans) — تعرض كل
الخطط الغذائية التي أنشأها المستخدم مع نوعها وحالتها
(نشطة أم لا) وأرقامها، وأزرار عرض الخطة وتحميلها PDF.

لماذا نحتاجه؟
حتى يجد المستخدم كل خططه التاريخية ويقارنها ويعيد
تحميلها متى شاء دون البحث عنها.

نوعها: Server Component (بدون 'use client').
نقرأ الخطط من قاعدة البيانات في الخادم قبل إرسال الصفحة.

متى يعمل؟
عند فتح /my-plans بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من القائمة
الجانبية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell + مكونات UI (Card, Badge, EmptyState).
- formatNumber و formatDate من lib/utils.
- PLAN_TYPES من lib/constants.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب كل خطط المستخدم مرتبة (النشطة أولًا ثم الأحدث).
3. لو لا توجد خطط → حالة فارغة مع زر إنشاء.
4. عرض بطاقة لكل خطة مع أزرار عرض وتحميل PDF.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { Download, Eye, Salad, Plus, CalendarDays, CheckCircle2, Circle } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.

// ملاحظة:
// يبدو أن الأيقونة Circle مستوردة هنا لكنها غير مستخدمة حاليًا.
// يجب التأكد قبل حذفها.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { Card, Badge, EmptyState } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.
import { formatNumber, formatDate } from '@/lib/utils'; // أدوات تنسيق الأرقام والتواريخ — ملف محلي.
import { PLAN_TYPES } from '@/lib/constants'; // أسماء أنواع الخطط بالعربية — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'البرنامج الغذائي' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
دالة: MyPlansPage — تعرض كل خطط المستخدم.
متى تعمل؟ عند فتح /my-plans.
خطواتها:
1. فحص تسجيل الدخول.
2. جلب الخطط من قاعدة البيانات (نشطة أولًا ثم الأحدث).
3. عرض بطاقة لكل خطة أو حالة فارغة.
*/
export default async function MyPlansPage() {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: جلب كل خطط هذا المستخدم.
  // orderBy: ترتيب بحقلين — النشطة أولاً (desc) ثم الأحدث إنشاءً.
  // select: نأخذ الأعمدة اللازمة للعرض فقط.
  const plans = await prisma.mealPlan.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      planType: true,
      isActive: true,
      totalCalories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      waterMl: true,
      mealsPerDay: true,
      durationDays: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">البرنامج الغذائي</h1>
          <p className="mt-1 text-sm text-slate-500">
            كل الخطط الغذائية التي أُنشئت لك — افتحها وتصفحها وحمّلها PDF في أي وقت.
          </p>
        </div>
        {/* زر إنشاء خطة جديدة */}
        <Link href="/plan/create" className="btn-primary">
          <Plus className="h-4 w-4" />
          إنشاء خطة جديدة
        </Link>
      </div>

      {/* لو لا توجد خطط: نعرض دعوة لإنشاء أول خطة */}
      {plans.length === 0 ? (
        <EmptyState
          icon={<Salad className="h-12 w-12" />}
          title="لا توجد خطط غذائية بعد"
          description="أنشئ خطتك الغذائية الذكية خلال دقائق بعد إدخال بيانات السباح، وستظهر هنا للعرض والتحميل."
          action={
            <Link href="/plan/create" className="btn-primary">
              <Salad className="h-4 w-4" />
              إنشاء خطة
            </Link>
          }
        />
      ) : (
        /* وإلا: بطاقة لكل خطة. map يمر على كل خطة p. */
        <div className="space-y-4">
          {plans.map((p) => (
            /* الخطة النشطة تُحاط بإطار مميز (ring) لتمييزها. */
            <Card key={p.id} className={p.isActive ? 'ring-2 ring-ocean-300' : ''}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-ocean-900">{p.title}</h2>
                    {/* شارة "الخطة الحالية" للنشطة فقط (شرط). */}
                    {p.isActive && (
                      <Badge color="green">
                        <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
                        الخطة الحالية
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {PLAN_TYPES[p.planType as keyof typeof PLAN_TYPES] ?? 'خطة غذائية'}
                    </span>
                    <span>أُنشئت {formatDate(p.createdAt)}</span>
                    <span>آخر تحديث {formatDate(p.updatedAt)}</span>
                  </div>
                </div>

                {/* أرقام الخطة: سعرات، بروتين، كربو/دهون، المدة */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold text-slate-400">السعرات</p>
                    <p className="text-sm font-black text-ocean-900">{formatNumber(p.totalCalories)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold text-slate-400">بروتين</p>
                    <p className="text-sm font-black text-ocean-900">{formatNumber(p.proteinG, 1)} جم</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold text-slate-400">كربو / دهون</p>
                    <p className="text-sm font-black text-ocean-900">
                      {formatNumber(p.carbsG, 1)} / {formatNumber(p.fatG, 1)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold text-slate-400">المدة</p>
                    <p className="text-sm font-black text-ocean-900">{p.durationDays} يوم</p>
                  </div>
                </div>

                {/* أزرار: عرض الخطة في صفحتها، وتحميلها PDF (API تُولّد الملف). */}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/plan/${p.id}`} className="btn-primary">
                    <Eye className="h-4 w-4" />
                    عرض الخطة
                  </Link>
                  <a href={`/api/plan/${p.id}/pdf`} className="btn-secondary">
                    <Download className="h-4 w-4" />
                    تحميل PDF
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
