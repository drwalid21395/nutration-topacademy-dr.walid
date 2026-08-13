/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/dashboard/page.tsx

وظيفة الملف:
لوحة تحكم المستخدم (المسار /dashboard) — أول صفحة بعد تسجيل
الدخول. تعرض: بطاقات التقدم (سعرات/ماء/بروتين/تمرين)،
التغذية الديناميكية اليوم، الخطة الحالية، ملخص اليوم،
الوزن، الإشعارات، وإجراءات سريعة.

نوعها: Server Component (بدون 'use client').
تعمل في الخادم وتقرأ قاعدة البيانات مباشرة قبل إرسال الصفحة.

ترتيب التنفيذ (من الأعلى):
1. getCurrentUser() → لو غير مسجل redirect('/login').
2. جلب كل بيانات اليوم من قاعدة البيانات (بالتوازي via Promise.all).
3. حساب مجموعات (سعرات، بروتين، ماء...) من السجلات.
4. حساب "الوجبة القادمة" حسب الوقت.
5. عرض كل شيء داخل AppShell.

لماذا Promise.all؟
نقرأ عدة جداول (طعام، ماء، تمرين، نوم، وزن، إشعارات، خطط)
في نفس الوقت بدل تسلسليًا — أسرع كثيرًا.

العلاقة مع الملفات:
- AppShell (القائمة الجانبية).
- getCurrentUser من lib/auth.
- prisma من lib/prisma (قراءة قاعدة البيانات).
- getTodayState من lib/nutrition/dynamic (الهدف الديناميكي).
- مكونات UI من components/ui.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // تحويل لصفحة أخرى
import Link from 'next/link';
import {
  Flame,
  Droplets,
  Utensils,
  Dumbbell,
  Camera,
  Salad,
  CalendarDays,
  TrendingUp,
  Bell,
  FileText,
  Pencil,
  RefreshCw,
  Plus,
  Moon,
  Zap,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Stat, ProgressRing, ProgressBar, Badge, Alert, EmptyState } from '@/components/ui';
import { MEAL_TYPES } from '@/lib/constants';
import { formatNumber, startOfToday, formatDate, cn } from '@/lib/utils';
import { getTodayState } from '@/lib/nutrition/dynamic';
import { AutoSync } from '@/components/wearables/auto-sync';

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح (مع template في layout).
export const metadata = { title: 'لوحة التحكم' };

// LOAD_AR: تحويل كلمة "تحميل التدريب" من الإنجليزية للمفتاح إلى العربية.
const LOAD_AR: Record<string, string> = {
  rest: 'راحة',
  light: 'خفيف',
  moderate: 'متوسط',
  hard: 'شاق',
  veryHigh: 'مرتفع جدًا',
};

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
-----------------------------------------
الدالة: DashboardPage
-----------------------------------------
متى تعمل؟ عند فتح /dashboard (بعد تسجيل الدخول).
خطواتها (قصة البيانات):
1. من المستخدم؟ لو لا أحد → إلى صفحة الدخول.
2. نجلب ملف السباح + الخطة النشطة + آخر نتائج الحساب.
3. نجلب سجلات اليوم: طعام، ماء، تمرين، نوم، وزن، إشعارات.
4. نجمع السعرات والبروتين... من سجلات الطعام.
5. نحدد الوجبة القادمة حسب الساعة.
6. نقرأ الهدف الديناميكي (يتغير مع نشاط الساعة).
7. نرسم كل شيء داخل الواجهة.
-----------------------------------------
*/
export default async function DashboardPage() {
  // الخطوة 1: من هو المستخدم؟ لو غير مسجل → ننقله لصفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: قراءة البيانات الأساسية بالتوازي.
  // Promise.all: تشغيل عدة عمليات "غير متزامنة" معًا (أسرع من التسلسل).
  const [profile, activePlan, latestTargets, todayStart] = await Promise.all([
    // ملف السباح الخاص بالمستخدم (أو null لو لم يُدخل بعد).
    prisma.swimmerProfile.findFirst({ where: { userId: user.id } }),
    // الخطة الغذائية النشطة + وجباتها + عناصرها (مرتبة بالأيام).
    prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
    }),
    // آخر نتائج حساب الاحتياجات الغذائية.
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
    }),
    // تاريخ اليوم في بداية اليوم (للمقارنة).
    startOfToday(),
  ]);

  // الخطوة 3: سجلات اليوم من ستة جداول في وقت واحد.
  const [foodLogs, waterLogs, trainingLogs, recoveryLog, weightLogs, notifications, planCount] =
    await Promise.all([
      prisma.foodLogEntry.findMany({
        where: { userId: user.id, date: { gte: todayStart } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.waterLogEntry.findMany({
        where: { userId: user.id, date: { gte: todayStart } },
      }),
      prisma.trainingLogEntry.findMany({
        where: { userId: user.id, date: { gte: todayStart } },
      }),
      prisma.recoveryLogEntry.findFirst({
        where: { userId: user.id, date: { gte: todayStart } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.weightLogEntry.findMany({
        where: { userId: user.id },
        orderBy: { date: 'asc' },
        take: 14, // آخر 14 سجل وزن للرسم البياني
      }),
      prisma.notification.findMany({
        where: { userId: user.id, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.mealPlan.count({ where: { userId: user.id } }),
    ]);

  // الخطوة 4: تجميع مجموعات اليوم.
  // reduce: يمر على كل عنصر ويجمع القيم — هنا نجمع السعرات.
  // (a = المجموع التراكمي، f = العنصر الحالي).
  const eatenCals = foodLogs.reduce((a, f) => a + (f.calories ?? 0), 0);
  const eatenProtein = foodLogs.reduce((a, f) => a + (f.proteinG ?? 0), 0);
  const eatenCarbs = foodLogs.reduce((a, f) => a + (f.carbsG ?? 0), 0);
  const eatenFat = foodLogs.reduce((a, f) => a + (f.fatG ?? 0), 0);
  const waterMl = waterLogs.reduce((a, w) => a + w.amountMl, 0);

  // القيم الهدف (من آخر حساب أو قيم افتراضية لو لا يوجد حساب بعد).
  const targetCals = latestTargets?.calories ?? 2200;
  const targetProtein = latestTargets?.proteinG ?? 120;
  const targetWater = latestTargets?.waterMl ?? 2800;

  // الخطوة 5: تحديد الوجبة القادمة حسب ساعة اليوم.
  // getHours(): الساعة الحالية (0-23). كل فترة زمنية = وجبة معينة.
  const nowHour = new Date().getHours();
  // نأخذ وجبات اليوم الأول من الخطة.
  const currentDay = activePlan?.meals?.filter((m) => m.dayNumber === 1) ?? [];
  const mealTypeNow = nowHour < 10 ? 'breakfast' : nowHour < 12 ? 'snack1' : nowHour < 15 ? 'lunch' : nowHour < 18 ? 'snack2' : 'dinner';
  const nextMeal = currentDay.find((m) => m.mealType === mealTypeNow) ?? currentDay[0];

  // الخطوة 6: مقارنة خطة اليوم بما سُجّل فعلًا (حسب نوع الوجبة).
  const planComparison = currentDay.map((m) => {
    const logged = foodLogs.filter((f) => f.mealType === m.mealType);
    const eaten = logged.reduce((a, f) => a + (f.calories ?? 0), 0);
    return {
      meal: m,
      logged: logged.length > 0,
      eatenCalories: eaten,
      plannedCalories: m.calories ?? 0,
    };
  });
  // مجموع السعرات المخطط والمستهلك من الخطة.
  const planCaloriesTarget = currentDay.reduce((a, m) => a + (m.calories ?? 0), 0);
  const planCaloriesEaten = planComparison.reduce((a, c) => a + (c.eatenCalories), 0);
  const planMealsDone = planComparison.filter((c) => c.logged).length;

  // هل أدخل المستخدم بياناته بعد؟
  const hasProfile = !!profile;

  // الخطوة 7: المحرك الديناميكي — الهدف يعدل حسب نشاط الساعة والتدريب.
  const todayState = await getTodayState(user.id);
  const dynamicTarget = todayState.dynamic?.adjustedCalories ?? targetCals;
  const dynamicWater = todayState.dynamic?.waterMl ?? targetWater;
  const dynamicProtein = todayState.dynamic?.proteinG ?? targetProtein;

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">
            مرحبًا، {user.name} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(new Date())} — ملخص اليوم في نظرة واحدة
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/wearables" className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            ربط الساعة
          </Link>
          <Link href="/meal-analyzer" className="btn-primary">
            <Camera className="h-4 w-4" />
            تحليل وجبة
          </Link>
          <Link href="/plan/create" className="btn-secondary">
            <Plus className="h-4 w-4" />
            خطة جديدة
          </Link>
        </div>
      </div>

      {!hasProfile && (
        <div className="mb-6">
          <Alert variant="info" title="ابدأ بإنشاء ملف السباح">
            لم تُدخل بيانات السباح بعد. لإعداد الحسابات والخطط تحتاج إدخال البيانات الأساسية أولًا.
          </Alert>
        </div>
      )}

      {/* بطاقات التقدم */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={(eatenCals / dynamicTarget) * 100} color="#1d84bc" label="السعرات اليومية" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(eatenCals)} / {formatNumber(dynamicTarget)} سعرة
            {todayState.dynamic?.isAdjusted ? <span className="mt-0.5 block font-bold text-ocean-600">هدف ديناميكي ⚡</span> : null}
            <span className="mt-0.5 block font-bold text-emerald-600">المتبقي {formatNumber(todayState.remainingCalories)}</span>
          </p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={(waterMl / dynamicWater) * 100} color="#17a8ab" label="الماء" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(waterMl)} / {formatNumber(dynamicWater)} مل
          </p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={(eatenProtein / dynamicProtein) * 100} color="#d9a23a" label="البروتين" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(eatenProtein, 1)} / {formatNumber(dynamicProtein, 1)} جم
          </p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing
            value={trainingLogs.length > 0 ? 100 : 0}
            color="#eab84b"
            label="التمرين اليوم"
          />
          <p className="text-center text-xs text-slate-500">
            {trainingLogs.length > 0 ? 'تم تسجيل التمرين ✓' : 'لم يُسجل بعد'}
          </p>
        </Card>
      </div>

      {/* التغذية الديناميكية */}
      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-ocean-900">
              <Zap className="h-4 w-4 text-gold-500" />
              التغذية الديناميكية اليوم
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">الهدف يتحدّث تلقائيًا مع نشاط ساعتك وتدريباتك.</p>
          </div>
          <Badge color={todayState.dynamic?.isAdjusted ? 'green' : 'slate'}>
            {todayState.dynamic?.isAdjusted ? `+${formatNumber(todayState.dynamic.activityCalories)} سعرة من النشاط` : 'بلا تعديل'}
          </Badge>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
          {/* السعرات */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-ocean-50 p-3">
              <span className="text-xs font-bold text-slate-500">الهدف الديناميكي</span>
              <span className="font-black text-ocean-900">{formatNumber(dynamicTarget)} سعرة</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-500">المستهلك</span>
              <span className="font-black text-slate-700">{formatNumber(eatenCals)} سعرة</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold-300/20 p-3">
              <span className="text-xs font-bold text-slate-500">إضافة النشاط</span>
              <span className="font-black text-gold-600">+{formatNumber(todayState.dynamic?.activityCalories ?? 0)} سعرة</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3">
              <span className="text-xs font-bold text-slate-500">المتبقي لليوم</span>
              <span className="font-black text-emerald-600">{formatNumber(todayState.remainingCalories)} سعرة</span>
            </div>
          </div>

          {/* الماكروز والماء */}
          <div className="space-y-3">
            <ProgressBar label={`البروتين (${formatNumber(eatenProtein, 1)}/${formatNumber(dynamicProtein, 1)} جم)`} value={(eatenProtein / dynamicProtein) * 100} color="gold" />
            <ProgressBar label={`الكربوهيدرات (${formatNumber(eatenCarbs, 1)}/${formatNumber(todayState.dynamic?.carbsG ?? latestTargets?.carbsG ?? 250, 1)} جم)`} value={(eatenCarbs / (todayState.dynamic?.carbsG ?? latestTargets?.carbsG ?? 250)) * 100} color="ocean" />
            <ProgressBar label={`الدهون (${formatNumber(eatenFat, 1)}/${formatNumber(todayState.dynamic?.fatG ?? latestTargets?.fatG ?? 70, 1)} جم)`} value={(eatenFat / (todayState.dynamic?.fatG ?? latestTargets?.fatG ?? 70)) * 100} color="green" />
            <ProgressBar label={`الماء (${formatNumber(waterMl)}/${formatNumber(dynamicWater)} مل)`} value={(waterMl / dynamicWater) * 100} color="ocean" />
          </div>

          {/* النشاط والاقتراح */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-ocean-900">{formatNumber(todayState.activity?.steps ?? 0)}</p>
                <p className="text-[10px] font-semibold text-slate-400">خطوة</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-ocean-900">{todayState.workoutMinutes}</p>
                <p className="text-[10px] font-semibold text-slate-400">دقيقة تدريب</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-ocean-900">{formatNumber(todayState.swimDistanceM, 0)}</p>
                <p className="text-[10px] font-semibold text-slate-400">م سباحة</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-ocean-900">{todayState.activity?.avgHeartRate ?? '—'}</p>
                <p className="text-[10px] font-semibold text-slate-400">نبض</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">تحميل التدريب</span>
                <Badge>{LOAD_AR[todayState.activity?.trainingLoad ?? 'rest'] ?? '—'}</Badge>
              </div>
              {todayState.activity?.loadScore != null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-ocean-500" style={{ width: `${todayState.activity.loadScore}%` }} />
                </div>
              )}
            </div>
            {todayState.nextMeal && (
              <div className="rounded-xl bg-gold-300/15 p-3">
                <p className="text-xs font-black text-ocean-900">🍽 {todayState.nextMeal.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{todayState.nextMeal.note}</p>
              </div>
            )}
          </div>
        </div>
        {todayState.dynamic?.reason && (
          <div className="border-t border-slate-100 bg-ocean-50/50 p-3 text-[11px] leading-relaxed text-slate-500">
            💡 {todayState.dynamic.reason}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* الوجبة القادمة والخطة */}
        <div className="space-y-5 lg:col-span-2">
          {activePlan ? (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-ocean-900">الخطة الحالية</h2>
                <Link href={`/plan/${activePlan.id}`} className="text-xs font-bold text-ocean-600 hover:underline">
                  عرض التفاصيل ←
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="السعرات اليومية" value={`${formatNumber(activePlan.totalCalories)}`} icon={<Flame className="h-5 w-5" />} />
                <Stat label="البروتين" value={`${formatNumber(activePlan.proteinG, 1)} جم`} icon={<Utensils className="h-5 w-5" />} />
                <Stat label="الماء" value={`${formatNumber((activePlan.waterMl ?? 0) / 1000, 1)} لتر`} icon={<Droplets className="h-5 w-5" />} />
              </div>

              {nextMeal ? (
                <div className="mt-4 rounded-xl bg-ocean-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-ocean-500">الوجبة القادمة · {nextMeal.timing}</p>
                      <p className="mt-1 text-lg font-black text-ocean-900">{nextMeal.title}</p>
                    </div>
                    <Badge color="gold">{formatNumber(nextMeal.calories)} سعرة</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextMeal.items.slice(0, 4).map((it, i) => (
                      <span key={i} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-ocean-100">
                        {it.foodNameAr}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="لا توجد وجبات في الخطة" description="أنشئ خطة جديدة لبدء المتابعة." />
              )}

              {planComparison.length > 0 && (
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-ocean-900">مقارنة خطة اليوم</h3>
                    <span className="text-xs font-bold text-slate-500">
                      {planMealsDone}/{planComparison.length} وجبات سُجّلت · {formatNumber(planCaloriesEaten)}/{formatNumber(planCaloriesTarget)} سعرة
                    </span>
                  </div>
                  <div className="space-y-2">
                    {planComparison.map(({ meal, logged, eatenCalories, plannedCalories }) => (
                      <div key={meal.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                              logged ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                            )}
                          >
                            {logged ? '✓' : ''}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{meal.title}</p>
                            <p className="text-[10px] text-slate-400">{MEAL_TYPES[meal.mealType as keyof typeof MEAL_TYPES] ?? ''} · {meal.timing}</p>
                          </div>
                        </div>
                        <span className={cn('shrink-0 text-xs font-black', logged ? 'text-emerald-600' : 'text-slate-400')}>
                          {logged ? `${formatNumber(eatenCalories)} سعرة` : `${formatNumber(plannedCalories)} سعرة`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <EmptyState
              icon={<Salad className="h-12 w-12" />}
              title="لا توجد خطة نشطة"
              description="أنشئ خطتك الغذائية الذكية خلال دقائق بعد إدخال بيانات السباح."
              action={<Link href="/plan/create" className="btn-primary"><Salad className="h-4 w-4" /> إنشاء خطة</Link>}
            />
          )}

          {/* ملخص اليوم */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-ocean-900">ملخص اليوم</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold text-slate-500">المغذيات المستهلكة</p>
                <div className="space-y-3">
                  <ProgressBar label={`البروتين (${formatNumber(eatenProtein, 1)}/${formatNumber(targetProtein, 1)} جم)`} value={(eatenProtein / targetProtein) * 100} color="gold" />
                  <ProgressBar label={`الكربوهيدرات (${formatNumber(eatenCarbs, 1)}/${formatNumber(latestTargets?.carbsG ?? 250, 1)} جم)`} value={(eatenCarbs / (latestTargets?.carbsG ?? 250)) * 100} color="ocean" />
                  <ProgressBar label={`الدهون (${formatNumber(eatenFat, 1)}/${formatNumber(latestTargets?.fatG ?? 70, 1)} جم)`} value={(eatenFat / (latestTargets?.fatG ?? 70)) * 100} color="green" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-slate-600">الوجبات المسجلة</span>
                  <Badge>{foodLogs.length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-slate-600">النوم الليلة الماضية</span>
                  <span className="font-bold text-ocean-800">{recoveryLog?.sleepHours ? `${recoveryLog.sleepHours} ساعة` : '—'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-slate-600">الوزن الحالي</span>
                  <span className="font-bold text-ocean-800">
                    {profile?.weightKg ? `${formatNumber(profile.weightKg, 1)} كجم` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-slate-600">الخطط المنشأة</span>
                  <span className="font-bold text-ocean-800">{planCount}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* تقدم الوزن */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-ocean-900">تقدم الوزن</h2>
              <Link href="/food-log" className="text-xs font-bold text-ocean-600 hover:underline">سجّل وزن اليوم</Link>
            </div>
            {weightLogs.length >= 2 ? (
              <div className="flex h-40 items-end gap-2">
                {weightLogs.map((w) => {
                  const min = Math.min(...weightLogs.map((x) => x.weightKg));
                  const max = Math.max(...weightLogs.map((x) => x.weightKg));
                  const range = Math.max(1, max - min);
                  const h = 12 + ((w.weightKg - min) / range) * 100;
                  return (
                    <div key={w.id} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-ocean-700">{formatNumber(w.weightKg, 1)}</span>
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-ocean-600 to-ocean-400" style={{ height: `${h}%`, maxHeight: 130 }} />
                      <span className="text-[9px] text-slate-400">{new Date(w.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">سجّل وزنك بانتظام لمشاهدة منحنى التقدم.</p>
            )}
          </Card>
        </div>

        {/* الشريط الجانبي */}
        <div className="space-y-5">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-ocean-900">
                <Bell className="h-4 w-4 text-ocean-500" />
                الإشعارات
              </h2>
              <Link href="/notifications" className="text-xs font-bold text-ocean-600 hover:underline">الكل</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد إشعارات جديدة.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-sm font-bold text-slate-700">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">إجراءات سريعة</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/swimmer-profile" className="flex flex-col items-center gap-1.5 rounded-xl bg-ocean-50 p-3 text-center text-xs font-bold text-ocean-700 hover:bg-ocean-100">
                <Pencil className="h-5 w-5" /> تعديل البيانات
              </Link>
              <Link href="/calculator" className="flex flex-col items-center gap-1.5 rounded-xl bg-ocean-50 p-3 text-center text-xs font-bold text-ocean-700 hover:bg-ocean-100">
                <RefreshCw className="h-5 w-5" /> إعادة الحساب
              </Link>
              <Link href="/food-log" className="flex flex-col items-center gap-1.5 rounded-xl bg-ocean-50 p-3 text-center text-xs font-bold text-ocean-700 hover:bg-ocean-100">
                <Utensils className="h-5 w-5" /> سجل الطعام
              </Link>
              <Link href="/reports" className="flex flex-col items-center gap-1.5 rounded-xl bg-ocean-50 p-3 text-center text-xs font-bold text-ocean-700 hover:bg-ocean-100">
                <FileText className="h-5 w-5" /> التقارير
              </Link>
            </div>
          </Card>

          {latestTargets && (
            <Card>
              <h2 className="mb-3 text-base font-bold text-ocean-900">الاحتياجات الحالية</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">معدل الأيض BMR</span><b>{formatNumber(latestTargets.bmr)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">إجمالي الاحتياج TDEE</span><b>{formatNumber(latestTargets.tdee)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">النطاق الآمن</span><b>{formatNumber(latestTargets.calorieMin)}-{formatNumber(latestTargets.calorieMax)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">الماء اليومي</span><b>{formatNumber((latestTargets.waterMl ?? 0) / 1000, 1)} لتر</b></div>
                <div className="flex justify-between"><span className="text-slate-500">مؤشر الكتلة BMI</span><b>{formatNumber(latestTargets.bmi, 1)}</b></div>
              </div>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-ocean-700 to-ocean-950 text-white">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-6 w-6 text-gold-400" />
              <div>
                <h3 className="font-bold">وضع الاستعداد للبطولة</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  خطط مخصصة للأسبوع السابق ويوم البطولة والاستشفاء بعدها.
                </p>
                <Link href="/competition-mode" className="btn-gold mt-3 !px-4 !py-2 !text-xs">بدء الوضع</Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <AutoSync />
    </AppShell>
  );
}
