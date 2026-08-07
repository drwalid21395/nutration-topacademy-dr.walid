'use client';

import { useEffect, useState } from 'react';
import {
  Trophy,
  CalendarDays,
  MapPin,
  Salad,
  ClipboardList,
  Download,
  Flame,
  Sparkles,
  Check,
  Plus,
  Moon,
  Droplets,
  Utensils,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/forms';
import { Card, Badge, Alert, EmptyState, ProgressBar } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/utils';

const DAY_COLORS: Record<string, string> = {
  competitionPrep: 'bg-ocean-500',
  competitionDay: 'bg-gold-500',
  postCompetition: 'bg-lagoon-500',
};

const PLAN_LABELS: Record<string, string> = {
  competitionPrep: 'خطة الاستعداد',
  competitionDay: 'خطة يوم البطولة',
  postCompetition: 'خطة الاستشفاء',
};

export function CompetitionMode({
  hasProfile,
  isMinor,
  profileName,
  nextCompetitionDate,
}: {
  hasProfile: boolean;
  isMinor: boolean;
  profileName: string | null;
  nextCompetitionDate: string | null;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', location: '', racesCount: '' });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);

  const load = async () => {
    const res = await fetch('/api/competition');
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch('/api/competition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        date: form.date,
        location: form.location,
        racesCount: Number(form.racesCount || 1),
      }),
    });
    const d = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(d.error ?? 'تعذر الحفظ');
      return;
    }
    setForm({ name: '', date: '', location: '', racesCount: '' });
    load();
  }

  async function removeCompetition(id: string) {
    await fetch(`/api/competition?id=${id}`, { method: 'DELETE' });
    load();
  }

  const countdown = data?.competition?.startDate ? Math.max(0, Math.ceil((new Date(data.competition.startDate).getTime() - Date.now()) / 86400000)) : null;

  if (!hasProfile) {
    return (
      <EmptyState
        icon={<Trophy className="h-12 w-12" />}
        title="أكمل ملف السباح أولًا"
        description="لا يمكن تجهيز وضع البطولة قبل إدخال بيانات السباح الأساسية (الطول، الوزن، التدريب، الهدف)."
        action={
          <Link href="/swimmer-profile" className="btn-primary">
            <ClipboardList className="h-4 w-4" />
            استكمال ملف السباح
          </Link>
        }
      />
    );
  }

  if (isMinor) {
    return (
      <Alert variant="warning" title="للرياضيين القاصرين">
        خطة البطولة المتاحة للقاصرين إرشادية فقط بأحجام آمنة، وتتطلب موافقة ولي الأمر واستشارة الطبيب قبل أي مكملات أو تغيير جذري في النظام الغذائي.
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">وضع البطولة</h1>
          <p className="mt-1 text-sm text-slate-500">استعداد غذائي كامل للبطولة: خطة ما قبل، يوم المنافسة، واستشفاء ما بعد.</p>
        </div>
        {data?.competition && (
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 px-5 py-3 text-white">
            <CalendarDays className="h-5 w-5" />
            {countdown !== null && (
              <span className="text-lg font-black">
                {countdown === 0 ? 'اليوم!' : `${formatNumber(countdown)} يوم`}
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-4"><Alert variant="danger">{error}</Alert></div>}
      {created.length > 0 && (
        <div className="mb-4">
          <Alert variant="success">تم إنشاء {created.length} خطة غذائية للبطولة ✓</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ocean-900">
            <Trophy className="h-5 w-5 text-gold-500" />
            البطولة الحالية
          </h2>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
          ) : data?.competition ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold-200 bg-gold-300/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-ocean-900">{data.competition.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(data.competition.startDate)}
                      {data.competition.location && (
                        <>
                          <span className="mx-1">·</span>
                          <MapPin className="h-4 w-4" />
                          {data.competition.location}
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">السباح: {profileName ?? '—'}</p>
                  </div>
                  <button onClick={() => removeCompetition(data.competition.id)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                    حذف البطولة
                  </button>
                </div>
                {nextCompetitionDate && (
                  <div className="mt-3">
                    <ProgressBar value={Math.max(0, Math.min(100, countdown ?? 0))} color="gold" label="الأيام المتبقية (منطقيًا 100 = اليوم الأخير)" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-ocean-900">خطط البطولة</h3>
                <div className="space-y-2.5">
                  {(['competitionPrep', 'competitionDay', 'postCompetition'] as const).map((type) => {
                    const plan = data.plans?.find((p: any) => p.planType === type);
                    return (
                      <div key={type} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${DAY_COLORS[type]}`}>
                            {type === 'competitionDay' ? <Flame className="h-5 w-5" /> : <Utensils className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{PLAN_LABELS[type]}</p>
                            {plan ? (
                              <p className="text-xs text-slate-500">
                                {formatNumber(plan.totalCalories ?? 0)} سعرة · {formatNumber(plan.proteinG ?? 0)} جم بروتين
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">لم تُنشأ بعد</p>
                            )}
                          </div>
                        </div>
                        {plan ? (
                          <div className="flex gap-2">
                            <Link href={`/plan/${plan.id}`} className="btn-secondary !px-3 !py-1.5 !text-xs">
                              عرض الخطة
                            </Link>
                            <Link href={`/api/plan/${plan.id}/pdf`} target="_blank" className="btn-secondary !px-3 !py-1.5 !text-xs">
                              <Download className="h-3.5 w-3.5" />
                              PDF
                            </Link>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => { setCreated((c) => [...c, type]); generatePlan(type); }} variant="gold">
                            <Sparkles className="h-3.5 w-3.5" />
                            إنشاء
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ocean-900"><ClipboardList className="h-4 w-4 text-ocean-500" /> قائمة التحقق</h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {[
                      'شهادات الفحص الطبي والبطاقة الرياضية',
                      'فوطتين + نظارة احتياطية',
                      'وجبات اليوم مقسّمة بعلب محكمة',
                      'قنينة ماء 1.5 لتر + كربوهيدرات سريعة (موز/عصير)',
                      'ملابس سباحة إضافية وتدفئة',
                    ].map((t) => <li key={t} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{t}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ocean-900"><Moon className="h-4 w-4 text-lagoon-500" /> إرشادات الليلة السابقة</h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {[
                      'عشاء غني بالنشويات المعقدة (أرز/مكرونة) + بروتين خفيف',
                      'النوم 8 ساعات كاملة في غرفة هادئة',
                      'تجهيز كل الحقيبة وترتيب النظارة والقبعة',
                      'شرب 500 مل ماء قبل النوم مع كوب حليب',
                    ].map((t) => <li key={t} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lagoon-500" />{t}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Trophy className="h-10 w-10" />}
              title="لا توجد بطولة مسجلة"
              description="سجّل البطولة القادمة ليجهز النظام لك خطط الاستعداد ويوم المنافسة والاستشفاء."
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ocean-900">
            <Plus className="h-4 w-4 text-ocean-500" />
            تسجيل بطولة جديدة
          </h2>
          <form onSubmit={create} className="space-y-3">
            <Field label="اسم البطولة" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: بطولة الجمهورية للناشئين" required />
            </Field>
            <Field label="تاريخ البطولة" required>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
            <Field label="المكان">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="المدينة / المسبح" />
            </Field>
            <Field label="عدد السباقات المتوقعة">
              <Input type="number" min={1} max={12} value={form.racesCount} onChange={(e) => setForm({ ...form, racesCount: e.target.value })} />
            </Field>
            <Button type="submit" loading={creating} className="w-full">
              <Trophy className="h-4 w-4" />
              حفظ البطولة
            </Button>
          </form>

          <div className="mt-5 rounded-xl bg-ocean-50 p-3 text-xs leading-relaxed text-ocean-800">
            <b>تلميح:</b> تُنشأ الخطط تلقائيًا حسب تاريخ البطولة من خطة الاستعداد قبل أسبوع، إلى يوم المنافسة، ثم الاستشفاء بعدها.
          </div>
        </Card>
      </div>
    </div>
  );

  async function generatePlan(type: string) {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType: type }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? 'تعذر إنشاء الخطة');
    }
    load();
  }
}
