import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  Utensils,
  Dumbbell,
  Droplets,
  Flame,
  Salad,
  Eye,
  MessageSquare,
  FileText,
  ArrowRight,
  ClipboardList,
  Pencil,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Badge, EmptyState } from '@/components/ui';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatNumber, formatDate, startOfToday } from '@/lib/utils';
import { ROLES, PLAN_TYPES } from '@/lib/constants';

export const metadata = { title: 'متابعة السباح' };

export default async function AdminSwimmerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { id } = await params;

  const swimmer = await prisma.user.findFirst({
    where: { id, role: 'athlete', status: { not: 'deleted' } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  if (!swimmer) notFound();

  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const [profile, plan, foodToday, foodWeek, trainings, waters, weights, analyses, notifications, planCount] =
    await Promise.all([
      prisma.swimmerProfile.findFirst({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.mealPlan.findFirst({
        where: { userId: id, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, planType: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true, durationDays: true, createdAt: true },
      }),
      prisma.foodLogEntry.findMany({
        where: { userId: id, date: { gte: todayStart } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.foodLogEntry.findMany({
        where: { userId: id, date: { gte: weekAgo } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.trainingLogEntry.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: 15,
      }),
      prisma.waterLogEntry.findMany({
        where: { userId: id, date: { gte: todayStart } },
      }),
      prisma.weightLogEntry.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      prisma.mealAnalysis.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.mealPlan.count({ where: { userId: id } }),
    ]);

  const caloriesToday = foodToday.reduce((a, f) => a + (f.calories ?? 0), 0);
  const proteinToday = foodToday.reduce((a, f) => a + (f.proteinG ?? 0), 0);
  const waterToday = waters.reduce((a, w) => a + w.amountMl, 0);
  const mealsToday = foodToday.length;
  const trainingsToday = trainings.filter((t) => t.date >= todayStart).length;

  const weekFoods = new Map<string, { cals: number; count: number }>();
  for (const f of foodWeek) {
    const key = f.date.toISOString().slice(0, 10);
    const cur = weekFoods.get(key) ?? { cals: 0, count: 0 };
    cur.cals += f.calories ?? 0;
    cur.count += 1;
    weekFoods.set(key, cur);
  }
  const daysActive = weekFoods.size;

  const pct = (v: number, t: number | null | undefined) => (t && t > 0 ? Math.min(100, Math.round((v / t) * 100)) : null);
  const calsPct = pct(caloriesToday, plan?.totalCalories);

  return (
    <AppShell user={user}>
      <Link href="/admin/dashboard" className="no-print mb-4 inline-flex items-center gap-1 text-xs font-bold text-ocean-600 hover:underline">
        <ArrowRight className="h-3.5 w-3.5" />
        عودة إلى لوحة الإدارة
      </Link>

      {/* رأس السباح */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <UserAvatar name={swimmer.name} image={swimmer.image} size="xl" className="h-12 w-12 sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black text-ocean-900 sm:text-2xl">{profile?.fullName ?? swimmer.name}</h1>
                <Badge color={swimmer.status === 'active' ? 'green' : 'gold'}>
                  {swimmer.status === 'active' ? 'نشط' : 'معلق'}
                </Badge>
                <Badge color="ocean">{ROLES[swimmer.role as keyof typeof ROLES] ?? swimmer.role}</Badge>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500" dir="ltr">{swimmer.email}</p>
              <p className="mt-1 text-xs text-slate-400">
                انضم {formatDate(swimmer.createdAt)}
                {swimmer.lastLoginAt ? ` · آخر دخول ${formatDate(swimmer.lastLoginAt)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href={`/my-profile?userId=${swimmer.id}`} className="btn-secondary w-full sm:w-auto">
              <ClipboardList className="h-4 w-4" />
              ملخص البيانات
            </Link>
            <Link href={`/messages?userId=${swimmer.id}`} className="btn-secondary w-full sm:w-auto">
              <MessageSquare className="h-4 w-4" />
              مراسلة
            </Link>
          </div>
        </div>

        {/* إحصائيات اليوم */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-ocean-50 p-3 text-center">
            <Flame className="mx-auto h-5 w-5 text-ocean-500" />
            <p className="mt-1 text-lg font-black text-ocean-900">{formatNumber(caloriesToday)}</p>
            <p className="text-xs font-semibold text-slate-400">
              سعرة اليوم{calsPct !== null ? ` · ${calsPct}% من الخطة` : ''}
            </p>
          </div>
          <div className="rounded-xl bg-gold-300/20 p-3 text-center">
            <Utensils className="mx-auto h-5 w-5 text-gold-500" />
            <p className="mt-1 text-lg font-black text-ocean-900">{mealsToday}</p>
            <p className="text-xs font-semibold text-slate-400">وجبة مسجلة اليوم · {proteinToday} جم بروتين</p>
          </div>
          <div className="rounded-xl bg-lagoon-100 p-3 text-center">
            <Droplets className="mx-auto h-5 w-5 text-lagoon-600" />
            <p className="mt-1 text-lg font-black text-ocean-900">{formatNumber(waterToday, 0)} مل</p>
            <p className="text-xs font-semibold text-slate-400">ماء اليوم</p>
          </div>
          <div className="rounded-xl bg-emerald-100 p-3 text-center">
            <Dumbbell className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-1 text-lg font-black text-ocean-900">{trainingsToday}</p>
            <p className="text-xs font-semibold text-slate-400">تمرين اليوم · {daysActive}/7 أيام تسجيل</p>
          </div>
        </div>
      </Card>

      {/* الخطة الحالية */}
      <div className="mt-5">
        {plan ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-ocean-900">{plan.title}</h2>
                  <Badge color="gold">{PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? 'خطة غذائية'}</Badge>
                  <Badge>{plan.durationDays} يوم</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>🔥 {formatNumber(plan.totalCalories)} سعرة</span>
                  <span>بروتين {formatNumber(plan.proteinG, 1)} جم</span>
                  <span>كربو {formatNumber(plan.carbsG, 1)} جم</span>
                  <span>دهون {formatNumber(plan.fatG, 1)} جم</span>
                  <span>ماء {formatNumber((plan.waterMl ?? 0) / 1000, 1)} لتر</span>
                  <span>أُنشئت {formatDate(plan.createdAt)}</span>
                </div>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Link href={`/plan/${plan.id}`} className="btn-primary w-full sm:w-auto">
                  <Eye className="h-4 w-4" />
                  عرض البرنامج
                </Link>
                <a href={`/api/plan/${plan.id}/pdf`} className="btn-secondary w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  تحميل PDF
                </a>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<Salad className="h-10 w-10" />}
            title="لا توجد خطة نشطة"
            description={`السباح لديه ${planCount} خطة إجمالًا لكن لا توجد خطة نشطة حاليًا.`}
            action={
              <Link href={`/my-profile?userId=${swimmer.id}`} className="btn-secondary">
                <Pencil className="h-4 w-4" />
                عرض ملف السباح
              </Link>
            }
          />
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* آخر الوجبات المسجلة */}
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">آخر الوجبات المسجلة</h2>
          {foodWeek.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد وجبات مسجلة خلال الأسبوع الأخير.</p>
          ) : (
            <div className="space-y-2">
              {foodWeek.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{f.foodName}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(f.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-black text-ocean-900">{formatNumber(f.calories)} سعرة</p>
                    {f.proteinG ? <p className="text-[10px] text-slate-400">بروتين {formatNumber(f.proteinG, 1)} جم</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* آخر التمارين */}
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">آخر التمارين</h2>
          {trainings.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد تمارين مسجلة.</p>
          ) : (
            <div className="space-y-2">
              {trainings.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{t.sessionType === 'gym' ? 'تمرين لياقة' : 'تمرين سباحة'}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatDate(t.date)}
                      {t.intensity ? ` · شدّة ${t.intensity}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-black text-ocean-900">{t.durationMin ?? 0} دقيقة</p>
                    {t.distanceM ? <p className="text-[10px] text-slate-400">{formatNumber(t.distanceM)} م</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* آخر الأوزان */}
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">آخر قياسات الوزن</h2>
          {weights.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد قياسات وزن.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {weights.map((w) => (
                <div key={w.id} className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-base font-black text-ocean-900">{formatNumber(w.weightKg, 1)} كجم</p>
                  <p className="text-[10px] text-slate-400">{formatDate(w.date)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* تحليلات الصور والإشعارات */}
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">تحليلات الوجبات (AI)</h2>
            {analyses.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد تحليلات.</p>
            ) : (
              <div className="space-y-2">
                {analyses.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{a.foods ?? 'وجبة محللة'}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(a.createdAt)} · {a.provider}</p>
                    </div>
                    <p className="shrink-0 text-xs font-black text-ocean-900">{formatNumber(a.totalCalories)} سعرة</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">الإشعارات</h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد إشعارات.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-700">{n.title}</p>
                      <span className="text-[10px] text-slate-400">{formatDate(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* تقرير التفصيلي */}
      <div className="mt-5">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 shrink-0 text-ocean-500" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">تقرير الالتزام التفصيلي</p>
              <p className="text-xs text-slate-400">تقرير PDF أو Excel للسباح خلال آخر 7 أيام.</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a href={`/api/admin/reports?format=pdf&userId=${swimmer.id}&days=7`} className="btn-primary w-full sm:w-auto">
              <Download className="h-4 w-4" />
              تقرير PDF
            </a>
            <a href={`/api/admin/reports?format=csv&userId=${swimmer.id}&days=7`} className="btn-secondary w-full sm:w-auto">
              <Download className="h-4 w-4" />
              تقرير Excel
            </a>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
