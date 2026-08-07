import { redirect } from 'next/navigation';
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
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Stat, ProgressRing, ProgressBar, Badge, Alert, EmptyState } from '@/components/ui';
import { MEAL_TYPES } from '@/lib/constants';
import { formatNumber, startOfToday, formatDate } from '@/lib/utils';

export const metadata = { title: 'لوحة التحكم' };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [profile, activePlan, latestTargets, todayStart] = await Promise.all([
    prisma.swimmerProfile.findFirst({ where: { userId: user.id } }),
    prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: { meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } } },
    }),
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
    }),
    startOfToday(),
  ]);

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
        take: 14,
      }),
      prisma.notification.findMany({
        where: { userId: user.id, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.mealPlan.count({ where: { userId: user.id } }),
    ]);

  const eatenCals = foodLogs.reduce((a, f) => a + (f.calories ?? 0), 0);
  const eatenProtein = foodLogs.reduce((a, f) => a + (f.proteinG ?? 0), 0);
  const eatenCarbs = foodLogs.reduce((a, f) => a + (f.carbsG ?? 0), 0);
  const eatenFat = foodLogs.reduce((a, f) => a + (f.fatG ?? 0), 0);
  const waterMl = waterLogs.reduce((a, w) => a + w.amountMl, 0);

  const targetCals = latestTargets?.calories ?? 2200;
  const targetProtein = latestTargets?.proteinG ?? 120;
  const targetWater = latestTargets?.waterMl ?? 2800;

  const remaining = Math.max(0, targetCals - eatenCals);

  // الوجبة القادمة حسب الوقت
  const nowHour = new Date().getHours();
  const currentDay = activePlan?.meals?.filter((m) => m.dayNumber === 1) ?? [];
  const mealTypeNow = nowHour < 10 ? 'breakfast' : nowHour < 12 ? 'snack1' : nowHour < 15 ? 'lunch' : nowHour < 18 ? 'snack2' : 'dinner';
  const nextMeal = currentDay.find((m) => m.mealType === mealTypeNow) ?? currentDay[0];

  const hasProfile = !!profile;

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
          <ProgressRing value={(eatenCals / targetCals) * 100} color="#1d84bc" label="السعرات اليومية" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(eatenCals)} / {formatNumber(targetCals)} سعرة
            <span className="mt-0.5 block font-bold text-emerald-600">المتبقي {formatNumber(remaining)}</span>
          </p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={(waterMl / targetWater) * 100} color="#17a8ab" label="الماء" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(waterMl)} / {formatNumber(targetWater)} مل
          </p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2">
          <ProgressRing value={(eatenProtein / targetProtein) * 100} color="#d9a23a" label="البروتين" />
          <p className="text-center text-xs text-slate-500">
            {formatNumber(eatenProtein, 1)} / {formatNumber(targetProtein, 1)} جم
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
    </AppShell>
  );
}
