/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/plan/[id]/page.tsx

وظيفة الملف:
صفحة تفاصيل الخطة الغذائية (المسار /plan/<معرف الخطة>).
تعرض ملخص الخطة (سعرات/مغذيات/ماء/وجبات)، اختيار اليوم،
وجبات كل يوم مع عناصرها ونصائح التحضير، بدائل الوجبات
(MealSwap)، قائمة المشتريات، وأزرار تحميل PDF.

لماذا نحتاجه؟
هي صفحة عرض الخطة الواحدة — يفتحها المستخدم بعد إنشاء
خطة أو من قائمة خططه لعرض التفاصيل والبدائل والتحميل.

نوعها: Server Component (بدون 'use client').
نقرأ الخطة من قاعدة البيانات في الخادم قبل إرسال الصفحة
(البدائل نفسها تصبح Client عبر مكوّن MealSwap).

متى يعمل؟
عند فتح /plan/<id> بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من زر "عرض
الخطة" أو بعد الإنشاء مباشرة.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell + مكونات UI.
- PlanActions و MealSwap من components/plan.
- formatNumber/formatDate من lib/utils و PLAN_TYPES من lib/constants.
- واجهات PDF: /api/plan/<id>/pdf.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. قراءة المعرّف من الرابط وجلب الخطة بوجباتها.
3. لو لا توجد (أو ليست له) → 404.
4. تجميع الوجبات حسب اليوم + قائمة المشتريات.
5. عرض الملخص ثم الأيام ثم المشتريات والنصائح.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect, notFound } from 'next/navigation'; // redirect: نقل. notFound: صفحة 404 — من مكتبة next/navigation.
import Link from 'next/link'; // رابط داخلي — من مكتبة next/link.
import { Download, Salad, Droplets, Flame, Utensils } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { Card, Badge, Alert, ProgressBar } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.

// ملاحظة:
// يبدو أن المكوّن ProgressBar مستورد هنا لكنه غير مستخدم حاليًا في هذا الملف.
// يجب التأكد قبل حذفه.
import { formatNumber, formatDate } from '@/lib/utils'; // أدوات تنسيق الأرقام والتواريخ — ملف محلي.
import { PLAN_TYPES } from '@/lib/constants'; // أسماء أنواع الخطط — ملف محلي.
import { PlanActions } from '@/components/plan/plan-actions'; // أزرار نسخ/حذف الخطة — ملف محلي.
import { MealSwap, type StoredAlternative } from '@/components/plan/meal-swap'; // مكوّن استبدال الوجبات + نوع البدائل — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'تفاصيل الخطة' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
دالة: PlanDetailPage — تعرض تفاصيل خطة واحدة.
متى تعمل؟ عند فتح /plan/<id>.
خطواتها (قصة البيانات):
1. فحص تسجيل الدخول.
2. قراءة id من الرابط وجلب الخطة بوجباتها وعناصرها.
3. لو لا خطة أو ليست له → 404.
4. تجميع الوجبات في Map حسب رقم اليوم.
5. بناء قائمة المشتريات من العناصر غير البديلة.
6. عرض الملخص والأيام والبدائل والمشتريات.
*/
export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  // الخطوة 1: من هو المستخدم؟ لو زائر → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نقرأ id من الرابط و created من المعلمات (قد تكون '1' بعد إنشاء جديد).
  const { id } = await params;
  const { created } = await searchParams;

  // الخطوة 3: نجلب الخطة بشرط أنها للمستخدم نفسه (userId: user.id) —
  // بهذا لا يرى المستخدم خطة مستخدم آخر حتى لو عرف المعرّف.
  const plan = await prisma.mealPlan.findFirst({
    where: { id, userId: user.id },
    include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
  });

  // لو لا توجد خطة بهذا المعرّف لهذا المستخدم → صفحة 404.
  if (!plan) notFound();

  // الخطوة 4: تجهيز البيانات للعرض.
  // عدد أيام الخطة.
  const totalDays = plan.durationDays;
  // mealsByDay: Map يخزن الوجبات كلها تحت رقم يومها
  // (map = قواميس: مفتاح → قائمة). نسير على كل وجبة ونضعها في مجموعتها.
  const mealsByDay = new Map<number, typeof plan.meals>();
  plan.meals.forEach((m) => {
    if (!mealsByDay.has(m.dayNumber)) mealsByDay.set(m.dayNumber, []);
    mealsByDay.get(m.dayNumber)!.push(m);
  });

  // dayNumbers: مصفوفة أرقام الأيام [1, 2, 3...] لرسم أزرار الاختيار.
  // Array.from: نُنشئ مصفوفة بمقدار totalDays، وكل عنصر i+1.
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  // shoppingList: قائمة المشتريات — مجموعة (Set) من أسماء الأطعمة.
  // نمر على كل الوجبات وعناصرها، ونستبعد البدائل (isAlternative)،
  // ونضيف اسم الطعام إلى المجموعة (Set يمنع التكرار تلقائيًا).
  const shoppingList = new Set<string>();
  plan.meals.forEach((m) =>
    m.items
      .filter((it) => !it.isAlternative)
      .forEach((it) => shoppingList.add(it.foodNameAr))
  );

  // mealList: نسخة بسيطة من الوجبات (للاستخدام داخل الدالة أدناه).
  const mealList = plan.meals;
  // storedAlternatives: دالة مساعدة تعيد البدائل المخزنة لوجبة معينة
  // مجمعة حسب نوع البديل (بروتين بديل، نشا بديل...).
  // StoredAlternative: نوع معرف في مكوّن MealSwap.
  function storedAlternatives(mealId: string): StoredAlternative[] {
    const meal = mealList.find((m) => m.id === mealId); // نبحث عن الوجبة.
    if (!meal) return []; // لو غير موجودة → قائمة فارغة.
    // byType: Map يجمع العناصر البديلة حسب نوع البديل.
    const byType = new Map<string, StoredAlternative>();
    meal.items
      .filter((it) => it.isAlternative && it.alternativeType) // البدائل فقط ذات النوع.
      .forEach((it) => {
        const type = it.alternativeType!;
        // لو النوع لم يظهر بعد ننشئه بوصفه "مجموعة فارغة".
        if (!byType.has(type)) byType.set(type, { type, items: [] });
        byType.get(type)!.items.push({ foodNameAr: it.foodNameAr, quantity: it.quantity });
      });
    return Array.from(byType.values()); // نحول الـ Map لقائمة.
  }

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      {/* رأس الصفحة: اسم الخطة ونوعها وأزرار PDF */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">{plan.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color="gold">{PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? 'خطة غذائية'}</Badge>
            <Badge>{totalDays} يوم</Badge>
            <span className="text-xs text-slate-500">أُنشئت في {formatDate(plan.createdAt)}</span>
          </div>
        </div>
        {/* أزرار: PDF كامل، PDF مختصر، وأزرار الخطة (نسخ/تعطيل/حذف). */}
        <div className="no-print flex flex-wrap gap-2">
          <a href={`/api/plan/${plan.id}/pdf`} className="btn-primary">
            <Download className="h-4 w-4" />
            تنزيل PDF
          </a>
          <a href={`/api/plan/${plan.id}/pdf?mode=brief`} className="btn-secondary">
            <Utensils className="h-4 w-4" />
            PDF مختصر
          </a>
          <PlanActions title={plan.title} path={`/plan/${plan.id}`} />
        </div>
      </div>

      {/* رسالة النجاح: تظهر لو وصل المستخدم للتو من الإنشاء (?created=1). */}
      {created === '1' && (
        <div className="mb-6">
          <Alert variant="success" title="تم إنشاء الخطة بنجاح">
            يمكنك استبدال أي وجبة من خلال الخطط البديلة أسفل كل وجبة، ثم تصدير الخطة PDF.
          </Alert>
        </div>
      )}

      {/* ملخص الخطة: أربع بطاقات (سعرات، مغذيات، ماء، وجبات) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="bg-gradient-to-br from-ocean-600 to-ocean-800 text-white">
          <Flame className="mb-1 h-6 w-6 text-gold-400" />
          <p className="text-xs text-ocean-200">سعرات اليوم</p>
          <p className="text-2xl font-black">{formatNumber(plan.totalCalories)}</p>
        </Card>
        <Card>
          <Salad className="mb-1 h-6 w-6 text-gold-500" />
          <p className="text-xs text-slate-500">بروتين / كربوهيدرات / دهون</p>
          <p className="text-lg font-black text-ocean-900">
            {formatNumber(plan.proteinG, 1)} / {formatNumber(plan.carbsG, 1)} / {formatNumber(plan.fatG, 1)} جم
          </p>
        </Card>
        <Card>
          <Droplets className="mb-1 h-6 w-6 text-lagoon-500" />
          <p className="text-xs text-slate-500">الماء اليومي</p>
          <p className="text-lg font-black text-ocean-900">{formatNumber((plan.waterMl ?? 0) / 1000, 1)} لتر</p>
        </Card>
        <Card>
          <Utensils className="mb-1 h-6 w-6 text-ocean-500" />
          <p className="text-xs text-slate-500">وجبات في اليوم</p>
          <p className="text-lg font-black text-ocean-900">{plan.mealsPerDay}</p>
        </Card>
      </div>

      {/* اختيار اليوم: روابط مرساة (anchor) تقفز إلى كل يوم عبر #day-<رقم> */}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {dayNumbers.map((d) => (
          <a key={d} href={`#day-${d}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-ocean-700 ring-1 ring-slate-200 transition-colors hover:bg-ocean-600 hover:text-white">
            {d}
          </a>
        ))}
      </div>

      {/* الأيام: map على أرقام الأيام، ولكل يوم بطاقة بها وجباته */}
      <div className="space-y-6">
        {dayNumbers.map((day) => {
          // وجبات هذا اليوم (قد تكون فارغة لو اليوم بدون وجبات).
          const meals = mealsByDay.get(day) ?? [];
          // مجاميع اليوم: نجمع سعرات/بروتين/كربو/دهون وجباته بـ reduce.
          const dayCals = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
          const dayP = meals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
          const dayC = meals.reduce((a, m) => a + (m.carbsG ?? 0), 0);
          const dayF = meals.reduce((a, m) => a + (m.fatG ?? 0), 0);
          return (
            // id=day-<رقم>: هدف روابط الاختيار أعلاه. scroll-mt-20 يترك مسافة عند القفز.
            <Card key={day} id={`day-${day}`} className="scroll-mt-20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black text-ocean-900">اليوم {day}</h2>
                {/* مجاميع اليوم الجاهزة */}
                <div className="flex gap-3 text-xs font-bold text-slate-500">
                  <span>{formatNumber(dayCals)} سعرة</span>
                  <span className="text-gold-600">بروتين {formatNumber(dayP, 1)}</span>
                  <span className="text-ocean-600">كربوهيدرات {formatNumber(dayC, 1)}</span>
                  <span className="text-lagoon-600">دهون {formatNumber(dayF, 1)}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* كل وجبة في بطاقة صغيرة: اسمها، وقتها، عناصرها، نصائح التحضير، بدائلها */}
                {meals.map((m, i) => (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge color="ocean">{m.title}</Badge>
                      <span className="text-xs font-bold text-slate-500">{formatNumber(m.calories)} سعرة</span>
                    </div>
                    {m.timing && <p className="mb-2 text-xs text-slate-500">⏰ {m.timing}</p>}
                    {/* عناصر الوجبة (البدائل مستبعدة هنا لأن لها قسمًا خاصًا).
                        filter: يعرض غير البدائل فقط، ثم map يرسم كل عنصر. */}
                    <ul className="space-y-1.5">
                      {m.items
                        .filter((it) => !it.isAlternative)
                        .map((it) => (
                          <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-slate-700">{it.foodNameAr}</span>
                            <span className="shrink-0 text-xs text-slate-400">{it.quantity}</span>
                          </li>
                        ))}
                    </ul>
                    {/* نصائح التحضير: whitespace-pre-line يحترم أسطر النص المحفوظة. */}
                    {m.note && (
                      <div className="mt-2 rounded-lg bg-ocean-50 px-2.5 py-2 text-xs text-ocean-800">
                        <span className="font-bold">كيفية التحضير والتجهيز:</span>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{m.note}</p>
                      </div>
                    )}
                    {/* مكوّن الاستبدال: يعرض البدائل المخزنة لهذه الوجبة ويسمح بتغييرها. */}
                    <MealSwap mealId={m.id} planId={plan.id} alternatives={storedAlternatives(m.id)} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* قائمة المشتريات ونصائح التحضير */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">قائمة المشتريات</h2>
          {/* Array.from: نحول Set المشتريات لقائمة ثم نرسمها كشارات. */}
          <div className="flex flex-wrap gap-2">
            {Array.from(shoppingList).map((s) => (
              <span key={s} className="rounded-full bg-ocean-50 px-3 py-1.5 text-sm font-semibold text-ocean-700 ring-1 ring-ocean-100">
                {s}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">نصائح تحضير الوجبات</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• حضّر البروتينات (دجاج/سمك) بكميات تكفي 2-3 أيام واحفظها بعلب محكمة.</li>
            <li>• جهّز الشوفان والأرز مسبقًا ووزّعه على حصص جاهزة.</li>
            <li>• احمل وجبات خفيفة (موز، تمر، مكسرات) معك للتدريب.</li>
            <li>• اشرب الماء على دفعات طوال اليوم، ولا تنتظر العطش.</li>
          </ul>
        </Card>
      </div>

      {/* تذكير طبي: الخطة إرشادية وتحتاج مراجعة مختص للقاصرين وأصحاب الحالات. */}
      <div className="mt-6">
        <Alert variant="info" title="تذكير">
          هذه الخطة تقديرية إرشادية. للقاصرين وأصحاب الحالات الصحية تُراجَع مع اختصاصي تغذية رياضية.
        </Alert>
      </div>
    </AppShell>
  );
}
