'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, FileText, Utensils, Dumbbell, Trophy, ShieldCheck, Ban, CheckCircle2, ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Badge, Alert, EmptyState } from '@/components/ui';
import { UserAvatar } from '@/components/ui/user-avatar';
import { AdminActivityBell } from '@/components/admin/admin-activity-bell';
import { formatDate, formatNumber } from '@/lib/utils';
import { ROLES } from '@/lib/constants';

const ROLE_BADGE: Record<string, 'ocean' | 'gold' | 'green' | 'red' | 'slate'> = {
  admin: 'red',
  coach: 'ocean',
  dietitian: 'green',
  guardian: 'gold',
  athlete: 'slate',
};

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [swimmers, setSwimmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSwimmers, setLoadingSwimmers] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/overview');
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  const loadSwimmers = async () => {
    const res = await fetch('/api/admin/swimmers');
    const d = await res.json();
    setSwimmers(d.swimmers ?? []);
    setLoadingSwimmers(false);
  };

  useEffect(() => {
    load();
    loadSwimmers();
  }, []);

  async function updateUser(userId: string, patch: { status?: string; role?: string }) {
    setMessage(null);
    const res = await fetch('/api/admin/overview', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch }),
    });
    if (res.ok) {
      setMessage('تم التحديث بنجاح.');
      load();
    }
  }

  if (loading && !data) {
    return <Card><p className="py-12 text-center text-sm text-slate-400">جارٍ التحميل…</p></Card>;
  }

  const stats = data.stats;
  const statCards = [
    { icon: Users, label: 'المستخدمون', value: stats.totalUsers },
    { icon: FileText, label: 'خطط غذائية', value: `${stats.activePlans} نشطة / ${stats.totalPlans}` },
    { icon: Utensils, label: 'سجلات طعام', value: stats.totalFoodLogs },
    { icon: Dumbbell, label: 'سجلات تدريب', value: stats.totalTrainings },
    { icon: Trophy, label: 'بطولات', value: stats.totalCompetitions },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-ocean-900">لوحة الإدارة</h1>
            <p className="text-sm text-slate-500">نظرة شاملة على المنصة وإدارة المستخدمين.</p>
          </div>
        </div>
        <AdminActivityBell />
      </div>

      {message && <div className="mb-4"><Alert variant="success">{message}</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-600">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-ocean-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ocean-900">
              <ClipboardCheck className="h-5 w-5 text-ocean-500" />
              التزام السباحين اليوم
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/admin/reports?format=pdf"
                download
                className="rounded-lg bg-ocean-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-ocean-700"
              >
                تقرير PDF
              </a>
              <a
                href="/api/admin/reports?format=csv"
                download
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                تقرير Excel
              </a>
              <Badge color="ocean">{swimmers.length} سباح</Badge>
            </div>
          </div>
          {loadingSwimmers ? (
            <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
          ) : swimmers.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title="لا يوجد سباحون بعد" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="pb-2 pr-2 font-bold">السباح</th>
                    <th className="pb-2 pr-2 font-bold">الخطة</th>
                    <th className="pb-2 pr-2 font-bold">السعرات اليوم</th>
                    <th className="pb-2 pr-2 font-bold">وجبات/تمارين</th>
                    <th className="pb-2 pr-2 font-bold">البروتين</th>
                    <th className="pb-2 pr-2 font-bold">الكربوهيدرات</th>
                    <th className="pb-2 pr-2 font-bold">الدهون</th>
                    <th className="pb-2 pr-2 font-bold">الماء</th>
                    <th className="pb-2 pr-2 font-bold">أيام التسجيل (7)</th>
                    <th className="pb-2 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {swimmers.map((s) => {
                    const a = s.adherence;
                    return (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-2">
                          <Link href={`/admin/swimmer/${s.id}`} className="group flex items-center gap-2.5">
                            <UserAvatar name={s.fullName} image={s.image} size="sm" />
                            <div className="min-w-0">
                              <p className="flex max-w-[140px] items-center gap-1 truncate text-sm font-bold text-slate-800 group-hover:text-ocean-700">
                                {s.fullName}
                                <Eye className="h-3 w-3 shrink-0 text-ocean-400 opacity-0 transition-opacity group-hover:opacity-100" />
                              </p>
                              <div className="flex items-center gap-1.5">
                                <p className="max-w-[110px] truncate text-xs text-slate-400" dir="ltr">{s.email}</p>
                                <a
                                  href={`/my-profile?userId=${s.id}`}
                                  className="shrink-0 rounded-md bg-ocean-50 px-1.5 py-0.5 text-[10px] font-bold text-ocean-700 hover:bg-ocean-100"
                                >
                                  ملخص
                                </a>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 pr-2">
                          {s.plan ? (
                            <div>
                              <p className="max-w-[150px] truncate text-xs font-bold text-ocean-700">{s.plan.title}</p>
                              <p className="text-[10px] text-slate-400">{s.plan.goal ?? ''}</p>
                            </div>
                          ) : (
                            <Badge color="gold">بدون خطة</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-2">
                          <div className="text-xs font-black text-ocean-900">{formatNumber(s.today?.calories ?? 0)} سعرة</div>
                          <div className="text-[10px] text-slate-400">
                            {a?.calories === null || a?.calories === undefined
                              ? 'لا توجد خطة'
                              : `${a.calories}% من الخطة`}
                          </div>
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                              <Utensils className="h-3.5 w-3.5 text-gold-500" />
                              {s.today?.mealsCount ?? 0} وجبة
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                              <Dumbbell className="h-3.5 w-3.5 text-emerald-500" />
                              {s.today?.trainingsCount ?? 0} تمرين
                            </span>
                          </div>
                        </td>
                        {(['protein', 'carbs', 'fat', 'water'] as const).map((key) => {
                          const pct = a?.[key];
                          const label = key === 'protein' ? 'بروتين' : key === 'carbs' ? 'كارب' : key === 'fat' ? 'دهون' : 'ماء';
                          const val = pct ?? 0;
                          const color = pct === null ? 'bg-slate-200' : val >= 85 ? 'bg-emerald-500' : val >= 50 ? 'bg-amber-400' : 'bg-red-400';
                          return (
                            <td key={key} className="py-3 pr-2">
                              <div className="min-w-[70px]">
                                <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                                  <span>{label}</span>
                                  <span className="font-bold">{pct === null ? '—' : `${val}%`}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100">
                                  <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, val))}%` }} />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-3 pr-2 text-center font-bold text-slate-700">{s.activeDays7}/7</td>
                        <td className="py-3 pr-2">
                          <Badge color={s.status === 'active' ? 'green' : 'gold'}>{s.status === 'active' ? 'نشط' : 'معلق'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-ocean-900">أحدث المستخدمين</h2>          {data.users.length === 0 ? (
            <EmptyState title="لا يوجد مستخدمون" />
          ) : (
            <div className="space-y-2.5">
              {data.users.map((u: any) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{u.name}</p>
                    <p className="truncate text-xs text-slate-400" dir="ltr">{u.email}</p>
                    <p className="text-xs text-slate-400">انضم {formatDate(u.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={ROLE_BADGE[u.role] ?? 'slate'}>{ROLES[u.role as keyof typeof ROLES] ?? u.role}</Badge>
                    <select
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600"
                    >
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {u.status === 'active' ? (
                      <Button size="sm" variant="secondary" onClick={() => updateUser(u.id, { status: 'suspended' })}>
                        <Ban className="h-3.5 w-3.5" />
                        تعليق
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => updateUser(u.id, { status: 'active' })}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        تفعيل
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">التوزيع بالأدوار</h2>
            <div className="space-y-2">
              {Object.entries(ROLES).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{v}</span>
                  <span className="font-black text-ocean-900">{stats.byRole?.[k] ?? 0}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">آخر الأحداث (Audit)</h2>
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد أحداث.</p>
            ) : (
              <div className="space-y-2">
                {data.recentAudit.map((a: any) => (
                  <div key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <p className="font-bold text-slate-700">{a.action}</p>
                    <p className="text-slate-400">{a.user?.email ?? 'نظام'} · {formatDate(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">صفحات المحتوى</h2>
            {data.contentPages.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد صفحات محتوى.</p>
            ) : (
              <div className="space-y-1.5">
                {data.contentPages.map((p: any) => (
                  <p key={p.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                    /{p.slug} · {p.titleAr}
                  </p>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
