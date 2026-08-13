'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Watch,
  Apple,
  Smartphone,
  HeartPulse,
  Activity,
  Footprints,
  ShieldCheck,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Dumbbell,
  Waves,
  Plus,
  Link2,
  PenIcon,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, Badge, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { formatShortDate, cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';

interface ProviderRow {
  id: string;
  nameAr: string;
  nameEn: string;
  requiresOAuth: boolean;
  configured: boolean;
  available: boolean;
  descriptionAr: string;
  connection: {
    id: string;
    providerName: string;
    status: string;
    deviceName?: string | null;
    scopes?: string | null;
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    source: string;
  } | null;
}

const ICONS: Record<string, React.ReactNode> = {
  appleHealth: <Apple className="h-6 w-6" />,
  healthConnect: <Smartphone className="h-6 w-6" />,
  samsungHealth: <Smartphone className="h-6 w-6" />,
  fitbit: <Activity className="h-6 w-6" />,
  garmin: <Watch className="h-6 w-6" />,
  huawei: <Smartphone className="h-6 w-6" />,
  xiaomi: <Smartphone className="h-6 w-6" />,
  amazfit: <Watch className="h-6 w-6" />,
  polar: <HeartPulse className="h-6 w-6" />,
  whoop: <HeartPulse className="h-6 w-6" />,
  oura: <Clock className="h-6 w-6" />,
  strava: <Activity className="h-6 w-6" />,
  manual: <PenIcon className="h-6 w-6" />,
};

export function WearablesPage({ user }: { user: SessionUser }) {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [tab, setTab] = useState<'activity' | 'workout'>('activity');

  const load = useCallback(async () => {
    const res = await fetch('/api/wearables/providers');
    const d = await res.json();
    setProviders(d.providers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const api = async (url: string, body?: unknown): Promise<{ ok: boolean; message?: string; error?: string }> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return res.json();
  };

  const connect = async (p: ProviderRow) => {
    setBusyId(p.id);
    setMessage(null);
    const res = await api('/api/wearables/connect', { provider: p.id });
    setBusyId(null);
    if (res.error) {
      setMessage({ type: 'err', text: res.error });
      await load();
      return;
    }
    if (p.id === 'manual') {
      setMessage({ type: 'ok', text: 'تم تفعيل الإدخال اليدوي — سجّل نشاطك وتدريباتك الآن.' });
      await load();
      return;
    }
    // إعادة الربط مع رابط OAuth عند وجود اعتماد في البيئة.
    const raw = await fetch('/api/wearables/providers');
    const data = await raw.json();
    const row = (data.providers ?? []).find((x: ProviderRow) => x.id === p.id);
    if (row?.connection?.status === 'connected') {
      setMessage({ type: 'ok', text: 'تم الربط بنجاح ✓' });
    } else {
      setMessage({ type: 'ok', text: 'الربط عبر هذا المزود يتطلب بيانات اعتماد رسمية — سيصبح متاحًا قريبًا.' });
    }
    await load();
  };

  const sync = async (p: ProviderRow) => {
    if (!p.connection) return;
    setBusyId(p.id);
    setMessage(null);
    const res = await api('/api/wearables/sync', { connectionId: p.connection.id });
    setBusyId(null);
    setMessage({ type: res.error ? 'err' : 'ok', text: res.error ?? res.message ?? 'تمت المزامنة.' });
    await load();
  };

  const disconnect = async (p: ProviderRow) => {
    if (!p.connection) return;
    setBusyId(p.id);
    setMessage(null);
    const res = await api('/api/wearables/disconnect', { connectionId: p.connection.id });
    setBusyId(null);
    setMessage({ type: res.error ? 'err' : 'ok', text: res.error ?? 'تم إلغاء الربط.' });
    await load();
  };

  const manual = providers.find((p) => p.id === 'manual');
  const connectedCount = providers.filter((p) => p.connection?.status === 'connected').length;

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ocean-900">
            <Watch className="h-6 w-6 text-ocean-600" />
            ربط ساعتك الذكية
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            اربط جهازك لمزامنة النشاط والتدريبات والنوم — وتتحدّث خطتك الغذائية تلقائيًا على مدار اليوم.
          </p>
        </div>
        <Badge color={connectedCount > 0 ? 'green' : 'slate'}>
          {connectedCount > 0 ? `${connectedCount} أجهزة مرتبطة ✓` : 'لا يوجد ربط بعد'}
        </Badge>
      </div>

      {message && (
        <div className="mb-5">
          <Alert variant={message.type === 'ok' ? 'success' : 'warning'} title={message.type === 'ok' ? 'تم' : 'تنبيه'}>
            {message.text}
          </Alert>
        </div>
      )}

      {/* بطاقة الرجوع للوحة */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-800">خصوصيتك محمية</p>
            <p className="text-xs text-slate-500">
              نستخدم OAuth الرسمي فقط، لا نطلب كلمة مرور ساعتك أبدًا، ويمكنك إلغاء الربط أو حذف البيانات في أي وقت.
            </p>
          </div>
        </div>
        <Link href="/dashboard" className="btn-secondary w-full sm:w-auto">
          لوحة التحكم
        </Link>
      </Card>

      {/* الإدخال اليدوي */}
      <Card className="mb-5 border-gold-200 bg-gold-300/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/30 text-gold-600">
              <PenIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">إدخال يدوي — متاح دائمًا</p>
              <p className="text-xs text-slate-500">
                لا تملك جهازًا مدعومًا الآن؟ سجّل خطواتك وتدريباتك (سباحة/لياقة) يدويًا ويُحدَّث المحرك الغذائي فورًا.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowManual((v) => !v)}>
            {showManual ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showManual ? 'إغلاق' : 'إدخال الآن'}
          </Button>
        </div>

        {showManual && (
          <ManualForms
            tab={tab}
            setTab={setTab}
            onSaved={(text) => {
              setMessage({ type: 'ok', text });
              load();
            }}
          />
        )}
      </Card>

      {/* شبكة المزودين */}
      <h2 className="mb-3 text-base font-bold text-ocean-900">منصات الأجهزة</h2>
      {loading ? (
        <p className="text-sm text-slate-400">جارٍ التحميل…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers
            .filter((p) => p.id !== 'manual')
            .map((p) => {
              const connected = p.connection?.status === 'connected';
              const busy = busyId === p.id;
              return (
                <Card key={p.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', connected ? 'bg-emerald-100 text-emerald-600' : 'bg-ocean-50 text-ocean-600')}>
                      {ICONS[p.id] ?? <Watch className="h-6 w-6" />}
                    </div>
                    <Badge color={connected ? 'green' : p.available ? 'gold' : 'slate'}>
                      {connected ? 'مرتبط ✓' : p.available ? 'متاح' : 'قريبًا'}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-black text-ocean-900">{p.nameAr}</h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{p.descriptionAr}</p>

                  {connected && p.connection ? (
                    <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">الجهاز</span>
                        <b className="text-slate-700">{p.connection.deviceName ?? p.connection.providerName}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">آخر مزامنة</span>
                        <b className="text-slate-700">{p.connection.lastSyncAt ? formatShortDate(p.connection.lastSyncAt) : '—'}</b>
                      </div>
                      {p.connection.lastSyncError && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          {p.connection.lastSyncError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex h-16 items-center justify-center rounded-xl bg-slate-50 text-[11px] font-bold text-slate-400">
                      {p.available ? 'لا يوجد ربط' : 'غير متاح بعد'}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {connected ? (
                      <>
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => sync(p)} className="flex-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          مزامنة الآن
                        </Button>
                        <Button size="sm" variant="danger" loading={busy} onClick={() => disconnect(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="w-full" loading={busy} onClick={() => connect(p)}>
                        <Link2 className="h-3.5 w-3.5" />
                        {p.available ? 'ربط الجهاز' : 'التنبيه عند التفعيل'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* كيف تعمل المزامنة */}
      <Card className="mt-5 p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold text-ocean-900">كيف تتغيّر خطتك تلقائيًا؟</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
          {['وصول البيانات', 'تحقق', 'تطبيع الطاقة', 'إزالة التكرار', 'إعادة الحساب', 'تحديث لوحة اليوم'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-lg bg-ocean-50 px-2.5 py-1.5 text-ocean-700 ring-1 ring-ocean-100">{s}</span>
              {i < arr.length - 1 && <span className="text-slate-300">←</span>}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          لا نضيف كل سعرات الساعة مباشرة — نطبّق معامل معاوضة حسب هدفك لتجنّب احتساب BMR أو تكرار نفس التمرين من أكثر من مصدر.
        </p>
      </Card>
    </AppShell>
  );
}

/* ====================== الإدخال اليدوي ====================== */

function ManualForms({
  tab,
  setTab,
  onSaved,
}: {
  tab: 'activity' | 'workout';
  setTab: (t: 'activity' | 'workout') => void;
  onSaved: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // نشاط
  const [steps, setSteps] = useState('');
  const [activeCals, setActiveCals] = useState('');
  const [workoutMin, setWorkoutMin] = useState('');
  const [sleepH, setSleepH] = useState('');
  const [avgHr, setAvgHr] = useState('');

  // تدريب
  const [sportType, setSportType] = useState('swim');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [laps, setLaps] = useState('');
  const [swolf, setSwolf] = useState('');
  const [intensity, setIntensity] = useState('moderate');

  const saveActivity = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/health/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'manual',
        activity: {
          steps: steps ? Number(steps) : 0,
          activeCalories: activeCals ? Number(activeCals) : undefined,
          workoutMinutes: workoutMin ? Number(workoutMin) : undefined,
          sleepMinutes: sleepH ? Number(sleepH) * 60 : undefined,
          avgHeartRate: avgHr ? Number(avgHr) : undefined,
        },
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.error) {
      setErr(d.error);
      return;
    }
    onSaved('تم حفظ نشاط اليوم — أُعيد حساب هدفك الغذائي.');
  };

  const saveWorkout = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/health/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'manual',
        workouts: [
          {
            sportType,
            startTime: new Date().toISOString(),
            durationMin: duration ? Number(duration) : undefined,
            distanceM: distance ? Number(distance) : undefined,
            caloriesBurned: calories ? Number(calories) : undefined,
            laps: laps ? Number(laps) : undefined,
            swolf: swolf ? Number(swolf) : undefined,
            intensity,
          },
        ],
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (d.error) {
      setErr(d.error);
      return;
    }
    onSaved('تم تسجيل التدريب — حدّثنا هدف الطاقة والسعرات المتبقية.');
  };

  const input = 'input';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'activity' ? 'primary' : 'secondary'} onClick={() => setTab('activity')}>
          <Footprints className="h-4 w-4" /> نشاط اليوم
        </Button>
        <Button size="sm" variant={tab === 'workout' ? 'primary' : 'secondary'} onClick={() => setTab('workout')}>
          <Dumbbell className="h-4 w-4" /> تسجيل تمرين
        </Button>
      </div>

      {err && (
        <div className="mt-3">
          <Alert variant="warning" title="تعذر الحفظ">{err}</Alert>
        </div>
      )}

      {tab === 'activity' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">الخطوات</span>
            <input className={input} type="number" min={0} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="مثال: 8000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">سعرات النشاط (اختياري)</span>
            <input className={input} type="number" min={0} value={activeCals} onChange={(e) => setActiveCals(e.target.value)} placeholder="سعرة" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">دقائق التدريب</span>
            <input className={input} type="number" min={0} value={workoutMin} onChange={(e) => setWorkoutMin(e.target.value)} placeholder="دقيقة" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">النوم (ساعات)</span>
            <input className={input} type="number" min={0} max={24} value={sleepH} onChange={(e) => setSleepH(e.target.value)} placeholder="مثال: 7.5" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold text-slate-600">متوسط نبض القلب (اختياري)</span>
            <input className={input} type="number" min={0} value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="نبضة/دقيقة" />
          </label>
          <div className="sm:col-span-2">
            <Button loading={busy} onClick={saveActivity} className="w-full sm:w-auto">
              <CheckCircle2 className="h-4 w-4" />
              حفظ نشاط اليوم
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">نوع التمرين</span>
            <select className={input} value={sportType} onChange={(e) => setSportType(e.target.value)}>
              <option value="swim">سباحة</option>
              <option value="gym">لياقة / جيم</option>
              <option value="run">جري</option>
              <option value="cycle">دراجة</option>
              <option value="walk">مشي</option>
              <option value="other">أخرى</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">الشدّة</span>
            <select className={input} value={intensity} onChange={(e) => setIntensity(e.target.value)}>
              <option value="low">منخفضة</option>
              <option value="moderate">متوسطة</option>
              <option value="high">مرتفعة</option>
              <option value="veryHigh">مرتفعة جدًا</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">المدة (دقيقة)</span>
            <input className={input} type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مثال: 60" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">المسافة (متر) — للسباحة/الجري</span>
            <input className={input} type="number" min={0} value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="مثال: 1500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">السعرات المحروقة (اختياري)</span>
            <input className={input} type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="سعرة" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">لفات السباحة</span>
              <input className={input} type="number" min={0} value={laps} onChange={(e) => setLaps(e.target.value)} placeholder="لفة" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">SWOLF</span>
              <input className={input} type="number" min={0} value={swolf} onChange={(e) => setSwolf(e.target.value)} placeholder="اختياري" />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button loading={busy} onClick={saveWorkout} className="w-full sm:w-auto">
              <CheckCircle2 className="h-4 w-4" />
              تسجيل التمرين
            </Button>
          </div>
          <div className="sm:col-span-2 flex items-start gap-2 text-[11px] text-slate-400">
            <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            تُسجَّل جلسات السباحة تلقائيًا في ملف السباح ومتابعة الأدمن.
          </div>
        </div>
      )}
    </div>
  );
}
