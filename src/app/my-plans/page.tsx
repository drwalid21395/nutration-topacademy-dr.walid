import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download, Eye, Salad, Plus, CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Badge, EmptyState } from '@/components/ui';
import { formatNumber, formatDate } from '@/lib/utils';
import { PLAN_TYPES } from '@/lib/constants';

export const metadata = { title: 'البرنامج الغذائي' };

export default async function MyPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">البرنامج الغذائي</h1>
          <p className="mt-1 text-sm text-slate-500">
            كل الخطط الغذائية التي أُنشئت لك — افتحها وتصفحها وحمّلها PDF في أي وقت.
          </p>
        </div>
        <Link href="/plan/create" className="btn-primary">
          <Plus className="h-4 w-4" />
          إنشاء خطة جديدة
        </Link>
      </div>

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
        <div className="space-y-4">
          {plans.map((p) => (
            <Card key={p.id} className={p.isActive ? 'ring-2 ring-ocean-300' : ''}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-ocean-900">{p.title}</h2>
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
