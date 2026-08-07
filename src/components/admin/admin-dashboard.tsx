'use client';

import { useEffect, useState } from 'react';
import { Users, FileText, Utensils, Dumbbell, Trophy, ShieldCheck, Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Badge, Alert, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/overview');
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  useEffect(() => {
    load();
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
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-ocean-900">لوحة الإدارة</h1>
          <p className="text-sm text-slate-500">نظرة شاملة على المنصة وإدارة المستخدمين.</p>
        </div>
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

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-ocean-900">أحدث المستخدمين</h2>
          {data.users.length === 0 ? (
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
