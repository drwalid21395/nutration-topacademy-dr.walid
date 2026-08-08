import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Download, Salad, Droplets, Flame, Utensils } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Badge, Alert, ProgressBar } from '@/components/ui';
import { formatNumber, formatDate } from '@/lib/utils';
import { PLAN_TYPES } from '@/lib/constants';
import { PlanActions } from '@/components/plan/plan-actions';
import { MealSwap, type StoredAlternative } from '@/components/plan/meal-swap';

export const metadata = { title: 'تفاصيل الخطة' };

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const { created } = await searchParams;

  const plan = await prisma.mealPlan.findFirst({
    where: { id, userId: user.id },
    include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
  });

  if (!plan) notFound();

  const totalDays = plan.durationDays;
  const mealsByDay = new Map<number, typeof plan.meals>();
  plan.meals.forEach((m) => {
    if (!mealsByDay.has(m.dayNumber)) mealsByDay.set(m.dayNumber, []);
    mealsByDay.get(m.dayNumber)!.push(m);
  });

  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  const shoppingList = new Set<string>();
  plan.meals.forEach((m) =>
    m.items
      .filter((it) => !it.isAlternative)
      .forEach((it) => shoppingList.add(it.foodNameAr))
  );

  const mealList = plan.meals;
  function storedAlternatives(mealId: string): StoredAlternative[] {
    const meal = mealList.find((m) => m.id === mealId);
    if (!meal) return [];
    const byType = new Map<string, StoredAlternative>();
    meal.items
      .filter((it) => it.isAlternative && it.alternativeType)
      .forEach((it) => {
        const type = it.alternativeType!;
        if (!byType.has(type)) byType.set(type, { type, items: [] });
        byType.get(type)!.items.push({ foodNameAr: it.foodNameAr, quantity: it.quantity });
      });
    return Array.from(byType.values());
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">{plan.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color="gold">{PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? 'خطة غذائية'}</Badge>
            <Badge>{totalDays} يوم</Badge>
            <span className="text-xs text-slate-500">أُنشئت في {formatDate(plan.createdAt)}</span>
          </div>
        </div>
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

      {created === '1' && (
        <div className="mb-6">
          <Alert variant="success" title="تم إنشاء الخطة بنجاح">
            يمكنك استبدال أي وجبة من خلال الخطط البديلة أسفل كل وجبة، ثم تصدير الخطة PDF.
          </Alert>
        </div>
      )}

      {/* ملخص الخطة */}
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

      {/* اختيار اليوم */}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {dayNumbers.map((d) => (
          <a key={d} href={`#day-${d}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-ocean-700 ring-1 ring-slate-200 transition-colors hover:bg-ocean-600 hover:text-white">
            {d}
          </a>
        ))}
      </div>

      {/* الأيام */}
      <div className="space-y-6">
        {dayNumbers.map((day) => {
          const meals = mealsByDay.get(day) ?? [];
          const dayCals = meals.reduce((a, m) => a + (m.calories ?? 0), 0);
          const dayP = meals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
          const dayC = meals.reduce((a, m) => a + (m.carbsG ?? 0), 0);
          const dayF = meals.reduce((a, m) => a + (m.fatG ?? 0), 0);
          return (
            <Card key={day} id={`day-${day}`} className="scroll-mt-20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black text-ocean-900">اليوم {day}</h2>
                <div className="flex gap-3 text-xs font-bold text-slate-500">
                  <span>{formatNumber(dayCals)} سعرة</span>
                  <span className="text-gold-600">بروتين {formatNumber(dayP, 1)}</span>
                  <span className="text-ocean-600">كربوهيدرات {formatNumber(dayC, 1)}</span>
                  <span className="text-lagoon-600">دهون {formatNumber(dayF, 1)}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {meals.map((m, i) => (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge color="ocean">{m.title}</Badge>
                      <span className="text-xs font-bold text-slate-500">{formatNumber(m.calories)} سعرة</span>
                    </div>
                    {m.timing && <p className="mb-2 text-xs text-slate-500">⏰ {m.timing}</p>}
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
                    {m.note && (
                      <div className="mt-2 rounded-lg bg-ocean-50 px-2.5 py-2 text-xs text-ocean-800">
                        <span className="font-bold">كيفية التحضير والتجهيز:</span>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{m.note}</p>
                      </div>
                    )}
                    <MealSwap mealId={m.id} planId={plan.id} alternatives={storedAlternatives(m.id)} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* قائمة المشتريات */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">قائمة المشتريات</h2>
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

      <div className="mt-6">
        <Alert variant="info" title="تذكير">
          هذه الخطة تقديرية إرشادية. للقاصرين وأصحاب الحالات الصحية تُراجَع مع اختصاصي تغذية رياضية.
        </Alert>
      </div>
    </AppShell>
  );
}
