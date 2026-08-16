/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/wearables/wearables-page.tsx

وظيفة الملف:
صفحة ربط الساعات الذكية — تعرض كل مزودي الأجهزة
(Apple Health، Google Health Connect، Samsung Health، Fitbit،
Garmin، Huawei... والإدخال اليدوي) مع:
- زر ربط/فك ربط كل مزود.
- زر مزامنة لكل جهاز مرتبط + عرض آخر مزامنة.
- شارة حالة (مرتبط/متاح/قريبًا).
- نموذج إدخال يدوي للأنشطة (خطوات، نوم، نبض) والتدريبات (سباحة/جيم).

لماذا نحتاجه؟
بدون هذه الصفحة لا يستطيع السباح إيصال بيانات ساعته الذكية
إلى النظام — وهي مصدر أساسي لحساب احتياجات الطاقة اليومية
وتحديث الخطة تلقائيًا.

'use client':
يعمل في المتصفح لأنه يستخدم useState/useEffect وfetch ونماذج.

متى يعمل؟
عند فتح /wearables.

من يستدعي هذا الملف؟
src/app/wearables/page.tsx.

الملفات التي يتعامل معها:
- API: /api/wearables/providers (القائمة)، connect، sync، disconnect،
  /api/health/activity و/api/health/workouts (الإدخال اليدوي).
- AppShell: هيكل الصفحة بعد الدخول.
- مكونات: Card، Badge، Alert، Button.

ترتيب العمل:
1. نجلب قائمة المزودين وحالات الربط ↓
2. "ربط الجهاز" → POST connect (OAuth للمزود الرسمي) ↓
3. "مزامنة الآن" → POST sync (جلب أحدث بيانات الجهاز) ↓
4. "إلغاء الربط" → POST disconnect ↓
5. إدخال يدوي: نموذجان (نشاط اليوم / تسجيل تمرين)
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useCallback (دالة محفوظة)، useEffect (تحميل أولي)، useState (حالة).
import { useCallback, useEffect, useState } from 'react';
// Link: رابط لوحة التحكم.
import Link from 'next/link';
// أيقونات من lucide-react لكل مزود وأزرار.
import {
  Watch,
  Smartphone,
  Footprints,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Dumbbell,
  Waves,
  Plus,
  PenIcon,
  X,
} from 'lucide-react';
// AppShell: الهيكل العام بعد الدخول (هيدر + فيوتر).
import { AppShell } from '@/components/layout/app-shell';
// مكونات واجهة.
import { Card, Badge, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
// أدوات مساعدة.
import { formatShortDate } from '@/lib/utils';
// SessionUser: نوع بيانات المستخدم من الجلسة.
import type { SessionUser } from '@/lib/auth';

// ========================================
// 2. الأنواع والبيانات الثابتة
// ========================================

// ProviderRow: صف واحد في قائمة المزودين.
interface ProviderRow {
  id: string;
  nameAr: string;
  nameEn: string;
  requiresOAuth: boolean; // هل الربط عبر نظام OAuth الرسمي؟
  configured: boolean; // هل لدينا بيانات اعتماد رسمية في الخادم؟
  available: boolean; // هل يمكن استخدامه الآن؟
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

// ========================================
// 3. المكوّن الرئيسي: WearablesPage
// ========================================

// WearablesPage: صفحة ربط الساعات الذكية.
// Props: user — بيانات المستخدم الحالي (تمرر إلى AppShell).
export function WearablesPage({ user }: { user: SessionUser }) {
  // providers: قائمة المزودين مع حالات الربط.
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  // message: رسالة الحالة (نجاح/خطأ) تظهر أعلى الصفحة.
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // showManual: هل نموذج الإدخال اليدوي مفتوح؟
  const [showManual, setShowManual] = useState(false);
  // tab: تبويب الإدخال اليدوي (نشاط أم تدريب).
  const [tab, setTab] = useState<'activity' | 'workout'>('activity');
  // today: نشاط اليوم الوارد من Health Connect.
  const [today, setToday] = useState<null | {
    steps?: number;
    distanceM?: number | null;
    activeCalories?: number | null;
    workoutMinutes?: number;
    sleepMinutes?: number | null;
    avgHeartRate?: number | null;
    updatedAt?: string;
  }>(null);
  // clearing: هل يجري مسح الشركات القديمة الآن؟
  const [clearing, setClearing] = useState(false);

  // load: جلب قائمة المزودين وبيانات اليوم من الخادم.
  const load = useCallback(async () => {
    const res = await fetch('/api/wearables/providers');
    const d = await res.json();
    setProviders(d.providers ?? []);
    setLoading(false);
    try {
      const todayRes = await fetch('/api/health/activity');
      const todayData = await todayRes.json();
      setToday(todayData.activity ?? null);
    } catch {
      setToday(null);
    }
  }, []);

  // عند أول ظهور نجلب القائمة.
  useEffect(() => {
    load();
  }, [load]);

  // api: اختصار لإرسال POST إلى أي مسار مع جسم JSON.
  const api = async (url: string, body?: unknown): Promise<{ ok: boolean; message?: string; error?: string }> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return res.json();
  };

  // clearOldCompanies: مسح جميع اتصالات شركات الساعات القديمة دفعة واحدة.
  const clearOldCompanies = async () => {
    if (!confirm('سيتم حذف جميع اتصالات شركات الساعات القديمة من حسابك. هل أنت متأكد؟')) return;
    setClearing(true);
    setMessage(null);
    const res = await api('/api/wearables/disconnect-all');
    setClearing(false);
    setMessage({ type: res.error ? 'err' : 'ok', text: res.error ?? 'تم حذف جميع شركات الساعات القديمة ✓' });
    await load();
  };

  // oldCompanies: اتصالات الشركات القديمة المرتبطة فعليًا (ماعدا الموبايل واليدوي).
  const oldCompanies = providers.filter(
    (p) => p.id !== 'mobile' && p.id !== 'manual' && p.connection?.status === 'connected'
  );
  // mobile: صف تطبيق الموبايل (Health Connect) — البديل الوحيد.
  const mobile = providers.find((p) => p.id === 'mobile');
  const mobileConnected = mobile?.connection?.status === 'connected';
  const mobileLastSync = mobile?.connection?.lastSyncAt ?? today?.updatedAt;

  return (
    <AppShell user={user}>
      {/* رأس الصفحة + شارة عدد الأجهزة */}
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
        <Badge color={mobileConnected ? 'green' : 'slate'}>
          {mobileConnected ? 'الموبايل مرتبط ✓' : 'لا يوجد ربط بعد'}
        </Badge>
      </div>

      {message && (
        <div className="mb-5">
          <Alert variant={message.type === 'ok' ? 'success' : 'warning'} title={message.type === 'ok' ? 'تم' : 'تنبيه'}>
            {message.text}
          </Alert>
        </div>
      )}

      {/* بطاقة خصوصية + زر لوحة التحكم */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-800">خصوصيتك محمية — لا حاجة لأي شركة ساعة</p>
            <p className="text-xs text-slate-500">
              تطبيق توب أكاديمي على هاتفك يقرأ بيانات ساعتك عبر Health Connect ويرسلها مباشرة — أذونات شفافة ويمكنك إيقافها في أي وقت.
            </p>
          </div>
        </div>
        <Link href="/dashboard" className="btn-secondary w-full sm:w-auto">
          لوحة التحكم
        </Link>
      </Card>

      {/* بطاقة تطبيق الموبايل (البديل الوحيد) */}
      <Card className="mb-5 overflow-hidden border-emerald-200">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-l from-emerald-50 to-white p-4 sm:p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Smartphone className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-ocean-900">تطبيق توب أكاديمي (Health Connect)</h2>
              <Badge color={mobileConnected ? 'green' : 'gold'}>
                {mobileConnected ? 'مرتبط ✓' : 'لم يُرتبط بعد'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              بديل لكل شركات الساعات — حمّل التطبيق، سجّل دخولك، وامنح أذونات Health Connect، وتصل بيانات ساعتك تلقائيًا.
            </p>
          </div>
        </div>

        {/* بيانات اليوم الواردة من Health Connect */}
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
          <TodayStat label="الخطوات" value={today ? String(today.steps ?? 0).padStart(4, '0') : '—'} />
          <TodayStat label="المسافة (م)" value={today ? String(Math.round(today.distanceM ?? 0)) : '—'} />
          <TodayStat label="سعرات النشاط" value={today ? String(Math.round(today.activeCalories ?? 0)) : '—'} />
          <TodayStat label="دقائق النشاط" value={today ? String(today.workoutMinutes ?? 0) : '—'} />
          <TodayStat label="النوم (دقيقة)" value={today ? String(today.sleepMinutes ?? 0) : '—'} />
          <TodayStat label="معدل النبض" value={today ? String(today.avgHeartRate ?? 0) : '—'} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
          <span className="text-[11px] font-bold text-slate-500">
            آخر وصول للبيانات: {mobileLastSync ? formatShortDate(mobileLastSync) : 'لم تصلك بيانات بعد'}
          </span>
          <a href="#" className="text-xs font-bold text-emerald-700 underline">
            تحميل تطبيق توب أكاديمي
          </a>
        </div>
      </Card>

      {/* تنبيه كيف تربط ساعتك والخصم المستمر للسعرات */}
      <Alert variant="success" title="كيف تربط ساعتك؟">
        <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed">
          <li>حمّل تطبيق توب أكاديمي على هاتفك (من متجر التطبيقات).</li>
          <li>سجّل دخولك بنفس حساب الموقع ثم افتح «ربط الساعة» داخل التطبيق.</li>
          <li>امنح أذونات Health Connect ليقرأ التطبيق الخطوات والنبض والنوم والمسافة.</li>
          <li>اضغط «مزامنة الآن» — وتصل البيانات فورًا لموقعنا وتتحدّث لوحة اليوم.</li>
        </ol>
        <p className="mt-2 text-xs font-bold text-emerald-800">
          ⚡ كل سعرة تحرقها ساعتك تُخصم فورًا من سعرات برنامجك وتُحدَّث لحظة بلحظة على مدار اليوم — لا انتظار، لا حساب يدوي.
        </p>
      </Alert>

      {/* مسح الشركات القديمة (يظهر فقط إن وُجدت اتصالات قديمة) */}
      {oldCompanies.length > 0 && (
        <Card className="mb-5 border-red-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                شركات الساعات القديمة ({oldCompanies.length})
              </p>
              <p className="text-xs text-slate-500">
                {oldCompanies.map((p) => p.nameAr).join('، ')} — لم تعد ضرورية لأن تطبيق الموبايل حلّ محلها.
              </p>
            </div>
            <Button size="sm" variant="danger" loading={clearing} onClick={clearOldCompanies}>
              <Trash2 className="h-3.5 w-3.5" />
              حذفها كلها
            </Button>
          </div>
        </Card>
      )}

      {/* الإدخال اليدوي: بطاقة ذهبية بنموذجين */}
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

        {/* النماذج تظهر عند الفتح — تمرر callbacks لرسالة النجاح وإعادة التحميل */}
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

      {/* كيف تعمل المزامنة: شرح مبسط بالخطوات */}
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

// ManualForms: النماذج اليدوية (نشاط اليوم / تسجيل تمرين).
// Props:
// - tab: التبويب النشط.
// - setTab: تغيير التبويب.
// - onSaved: دالة تستدعى بعد نجاح الحفظ (تعرض الرسالة وتحدّث القائمة).
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

  // حقول "نشاط اليوم".
  const [steps, setSteps] = useState('');
  const [activeCals, setActiveCals] = useState('');
  const [workoutMin, setWorkoutMin] = useState('');
  const [sleepH, setSleepH] = useState('');
  const [avgHr, setAvgHr] = useState('');

  // حقول "تسجيل تمرين".
  const [sportType, setSportType] = useState('swim');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [laps, setLaps] = useState('');
  const [swolf, setSwolf] = useState('');
  const [intensity, setIntensity] = useState('moderate');

  // saveActivity: حفظ نشاط اليوم عبر /api/health/activity.
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
          sleepMinutes: sleepH ? Number(sleepH) * 60 : undefined, // نحول الساعات إلى دقائق
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

  // saveWorkout: حفظ تمرين عبر /api/health/workouts.
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
            startTime: new Date().toISOString(), // وقت البدء = الآن
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

  // input: فئة الحقول (نفس الاسم المستخدم في كل النموذج).
  const input = 'input';

  return (
    <div className="mt-4">
      {/* أزرار التبويبين */}
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
        /* ===== نموذج نشاط اليوم ===== */
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
        /* ===== نموذج تسجيل تمرين ===== */
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

/* ====================== بطاقة إحصائية اليوم ====================== */

// TodayStat: قيمة واحدة في شبكة بيانات اليوم القادمة من Health Connect.
function TodayStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-3 py-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-ocean-900">{value}</p>
    </div>
  );
}
