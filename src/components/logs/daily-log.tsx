/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/logs/daily-log.tsx

وظيفة الملف:
مكوّن واحد يدير 5 أنواع سجلات يومية:
1. food (الطعام) — سعرات وبروتين وكربوهيدرات ودهون.
2. water (الماء) — الكمية بالمل.
3. training (التمارين) — سباحة أو لياقة، مدة ومسافة.
4. recovery (النوم والاستشفاء) — ساعات النوم + مستويات الطاقة/الجوع/الإجهاد/الاستشفاء.
5. weight (الوزن) — قياس كجم.

يعرض: مجمّع اليوم مع حلقة تقدم (ProgressRing)، قائمة
السجلات مع إمكانية الحذف، نموذج إضافة إدخال جديد، واختيار تاريخ.

لماذا نحتاجه؟
هو "قلب" تتبع الالتزام اليومي للسباح — بدونه لا توجد
بيانات يعرضها لوح المدرب ولا تقارير ولا رسوم.

'use client':
يعمل في المتصفح لأنه يستخدم useState/useEffect/useCallback/useMemo
ونموذج إدخال وزر حذف.

متى يعمل؟
في صفحات /food-log و/water-log و/training-log
و/recovery-log و/weight-log (كل صفحة تمرر نوعها).

من يستدعي هذا الملف؟
صفحات السجلات الخمس السابقة.

الملفات التي يتعامل معها:
- API: /api/logs (GET قائمة، POST إضافة، DELETE حذف).
- MEAL_TYPES من lib/constants: أسماء أنواع الوجبات.
- مكونات: Button، Input/Select/Textarea/Field، Card، Badge، Alert، EmptyState، ProgressRing، Stat.

ترتيب العمل:
1. نقرأ نوع السجل من الخاصية type ↓
2. نجلب سجلات التاريخ المختار (افتراضيًا اليوم) ↓
3. نحسب المجموع (totals) حسب النوع ↓
4. نموذج الإضافة يختلف حسب النوع (شروط type ===) ↓
5. حفظ/حذف ثم إعادة تحميل القائمة
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useCallback (دالة محفوظة)، useEffect (كود بعد العرض)،
// useMemo (حساب محفوظ)، useState (حالة متغيرة).
import { useCallback, useEffect, useMemo, useState } from 'react';
// أيقونات من lucide-react لكل نوع سجل + أيقونات شائعة.
import { Utensils, Droplets, Dumbbell, Moon, Plus, Trash2, Weight, CalendarDays } from 'lucide-react';
// Button: زر جاهز.
import { Button } from '@/components/ui/button';
// مكونات النموذج الجاهزة.
import { Input, Select, Textarea, Field } from '@/components/ui/forms';
// مكونات واجهة جاهزة.
import { Card, Badge, Alert, EmptyState, ProgressRing, Stat } from '@/components/ui';
// MEAL_TYPES: قاموس أسماء أنواع الوجبات (فطور، غداء...).
import { MEAL_TYPES } from '@/lib/constants';
// cn: دمج فئات Tailwind شرطيًا.
import { cn } from '@/lib/utils';

// ========================================
// 2. أنواع البيانات والإعدادات
// ========================================

// LogType: أنواع السجلات الخمسة الممكنة.
export type LogType = 'food' | 'water' | 'training' | 'recovery' | 'weight';

// CONFIG: إعدادات كل نوع — العنوان والأيقونة والوحدة واللون.
const CONFIG: Record<
  LogType,
  {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    unit: string;
    color: string;
  }
> = {
  food: { title: 'سجل الطعام', icon: Utensils, unit: 'سعرة', color: '#1d84bc' },
  water: { title: 'سجل الماء', icon: Droplets, unit: 'مل', color: '#17a8ab' },
  training: { title: 'سجل التمارين', icon: Dumbbell, unit: 'دقيقة', color: '#d9a23a' },
  recovery: { title: 'النوم والاستشفاء', icon: Moon, unit: '', color: '#7c6bd6' },
  weight: { title: 'سجل الوزن', icon: Weight, unit: 'كجم', color: '#d9a23a' },
};

// toDateParam: تحويل Date إلى نص بالشكل YYYY-MM-DD
// (لأن <input type="date"> يتعامل بهذا الشكل فقط).
function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ========================================
// 3. المكوّن الرئيسي: DailyLog
// ========================================

// DailyLog: صفحة السجل حسب النوع.
// Props:
// - type: أي نوع من الأنواع الخمسة.
// - user: بيانات المستخدم (الاسم/البريد/الدور).
// - targets: أهداف اليوم (سعرات/بروتين/ماء) لعرض التقدم.
// - todayMeals: وجبات خطة اليوم (لسجّل سريع بسطر واحد).
export function DailyLog({
  type,
  user,
  targets,
  todayMeals = [],
}: {
  type: LogType;
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
  targets: { calories?: number | null; proteinG?: number | null; waterMl?: number | null; carbsG?: number | null; fatG?: number | null } | null;
  todayMeals?: { id: string; mealType: string; title: string; calories: number | null; items: { foodNameAr: string; grams: number | null }[] }[];
}) {
  // cfg: إعدادات نوعنا الحالي (عنوان/أيقونة/لون).
  const cfg = CONFIG[type];
  // items: سجلات التاريخ المختار.
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // form: حقول نموذج الإضافة (حسب النوع).
  const [form, setForm] = useState<any>({});
  // selectedDate: التاريخ المختار (افتراضيًا اليوم).
  const [selectedDate, setSelectedDate] = useState<string>(toDateParam(new Date()));

  // load: جلب سجلات اليوم المختار — محفوظة بـ useCallback
  // لئلا تتغير الدالة إلا عند تغيّر type أو selectedDate.
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/logs?type=${type}&date=${selectedDate}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, [type, selectedDate]);

  // عند تغير load (أي عند التحميل أو تغيير اليوم) نجلب السجلات.
  useEffect(() => {
    load();
  }, [load]);

  // add: حفظ إدخال جديد من النموذج.
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...form, date: selectedDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? 'تعذر الحفظ');
      return;
    }
    setForm({}); // نمسح النموذج بعد النجاح.
    setMessage(null);
    load();
  }

  // remove: حذف سجل بمعرفه.
  async function remove(id: string) {
    const res = await fetch(`/api/logs?type=${type}&id=${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  // logFromPlan: تسجيل وجبة من خطة اليوم بضغطة واحدة
  // (بدل كتابة كل التفاصيل يدويًا).
  async function logFromPlan(meal: { id: string; mealType: string; title: string; calories: number | null; items: { foodNameAr: string; grams: number | null }[] }) {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'food',
        date: selectedDate,
        mealType: meal.mealType,
        foodName: meal.title,
        calories: meal.calories ?? undefined,
        note: meal.items.map((i) => i.foodNameAr).join('، '), // ندمج أسماء الأطعمة كملاحظة
        source: 'plan', // علامة: أُدخل من الخطة
      }),
    });
    if (res.ok) {
      setMessage(null);
      load();
    }
  }

  // isToday: هل التاريخ المختار هو اليوم؟ (نستخدمها لعرض زر "العودة لليوم").
  const isToday = selectedDate === toDateParam(new Date());

  // totals: حساب ملخص اليوم حسب النوع — محفوظ بـ useMemo
  // حتى لا يُعاد الحساب إلا عند تغيّر items أو type أو targets.
  const totals = useMemo(() => {
    if (type === 'food') {
      // مجموع السعرات من كل الإدخالات (reduce يجمع).
      return {
        main: items.reduce((a, i) => a + (i.calories ?? 0), 0),
        target: targets?.calories ?? 2200,
        sub: `بروتين ${items.reduce((a, i) => a + (i.proteinG ?? 0), 0).toFixed(1)} / ${targets?.proteinG ?? 120} جم`,
      };
    }
    if (type === 'water') {
      // مجموع الماء بالمل.
      return {
        main: items.reduce((a, i) => a + (i.amountMl ?? 0), 0),
        target: targets?.waterMl ?? 2800,
        sub: 'من الهدف اليومي',
      };
    }
    if (type === 'training') {
      // عدد جلسات اليوم (الهدف = 1 جلسة).
      return { main: items.length, target: 1, sub: 'جلسات اليوم' };
    }
    if (type === 'recovery') {
      // آخر سجلات النوم — نأخذ آخر إدخال في القائمة.
      const last = items[items.length - 1];
      return { main: last?.sleepHours ?? 0, target: 8, sub: 'ساعات النوم' };
    }
    // weight: آخر قياس وزن مسجل.
    return { main: items[items.length - 1]?.weightKg ?? 0, target: targets?.calories ?? 1, sub: 'آخر قياس' };
  }, [items, type, targets]);

  return (
    <div>
      {/* رأس الصفحة: العنوان + حلقة التقدم مع الرقم */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">{cfg.title}</h1>
          <p className="mt-1 text-sm text-slate-500">سجّل بيانات اليوم لمتابعة الالتزام والتقدم.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* حلقة النسبة المئوية لتحقيق الهدف */}
          <ProgressRing value={(totals.main / totals.target) * 100} size={88} strokeWidth={8} color={cfg.color} label={`${cfg.unit}`} />
          <div>
            <p className="text-xl font-black text-ocean-900">{Number(totals.main).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-slate-500">{totals.sub}</p>
          </div>
        </div>
      </div>

      {/* اختيار التاريخ (للتسجيل بأثر رجعي) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
          <CalendarDays className="h-4 w-4 text-ocean-500" />
          <input
            type="date"
            dir="ltr"
            value={selectedDate}
            max={toDateParam(new Date())} // لا يمكن اختيار تاريخ مستقبلي.
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="bg-transparent text-sm font-bold text-ocean-800 outline-none"
          />
        </label>
        {!isToday && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedDate(toDateParam(new Date()))}>
            العودة لليوم الحالي
          </Button>
        )}
      </div>

      {/* رسالة خطأ الحفظ إن حدثت */}
      {message && (
        <div className="mb-4">
          <Alert variant="danger">{message}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            {/* عنوان يعرض التاريخ المختار بالعربية */}
            <h2 className="mb-4 text-base font-bold text-ocean-900">
              سجل {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
            ) : items.length === 0 ? (
              <EmptyState title="لا توجد سجلات في هذا اليوم" description="سجّل إدخالًا من النموذج المجاور أو من خطة اليوم." />
            ) : (
              // قائمة السجلات: بطاقة لكل إدخال مع زر حذف.
              <div className="space-y-2.5">
                {items.map((it) => (
                  <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* شارة نوع الوجبة (فطور/غداء...) */}
                      <Badge color="ocean">{MEAL_TYPES[it.mealType as keyof typeof MEAL_TYPES] ?? 'وجبة'}</Badge>
                      <div>
                        {/* اسم الإدخال حسب النوع (عامل ثلاثي) */}
                        <p className="text-sm font-bold text-slate-800">
                          {type === 'food' ? it.foodName : type === 'water' ? 'شرب ماء' : type === 'training' ? (it.sessionType === 'swim' ? 'سباحة' : 'لياقة') : type === 'recovery' ? 'استشفاء' : 'قياس وزن'}
                        </p>
                        {/* تفاصيل إضافية حسب النوع */}
                        {type === 'training' && <p className="text-xs text-slate-500">{it.durationMin ? `${it.durationMin} دقيقة` : ''} {it.distanceM ? `· ${it.distanceM} م` : ''}</p>}
                        {type === 'recovery' && (
                          <p className="text-xs text-slate-500">
                            نوم {it.sleepHours ?? '—'} سا · طاقة {it.energyLevel ?? '—'}/10 · استشفاء {it.recoveryLevel ?? '—'}/10
                          </p>
                        )}
                        {type === 'food' && it.note && <p className="text-xs text-slate-400">{it.note}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        {/* القيمة الرئيسية (سعرات/مل/كجم) */}
                        <p className="font-black text-ocean-900">
                          {type === 'food' ? `${it.calories ?? 0} سعرة` : type === 'water' ? `${it.amountMl} مل` : type === 'weight' ? `${it.weightKg} كجم` : ''}
                        </p>
                        {type === 'food' && (
                          <p className="text-xs text-slate-400">
                            بروتين {it.proteinG ?? 0} جم{it.waterMl ? ` · ماء ${it.waterMl} مل` : ''}
                          </p>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(it.id)} aria-label="حذف">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* للطعام: سجّل سريعًا من وجبات خطة اليوم */}
          {type === 'food' && todayMeals.length > 0 && isToday && (
            <Card>
              <h2 className="mb-4 text-base font-bold text-ocean-900">سجّل من خطة اليوم</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {todayMeals.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-ocean-50/70 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-ocean-900">{m.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {MEAL_TYPES[m.mealType as keyof typeof MEAL_TYPES] ?? ''} · {m.calories ?? 0} سعرة
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={() => logFromPlan(m)}>
                      <Plus className="h-3.5 w-3.5" />
                      سجّلها
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* نموذج إضافة إدخال جديد — حقوله تتغير حسب النوع */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ocean-900">
            <Plus className="h-4 w-4 text-ocean-500" />
            إضافة جديد
          </h2>
          <form onSubmit={add} className="space-y-3">
            {/* type === 'food': حقول الطعام */}
            {type === 'food' && (
              <>
                <Field label="اسم الطعام / الوجبة" required>
                  <Input value={form.foodName ?? ''} onChange={(e) => setForm({ ...form, foodName: e.target.value })} placeholder="مثال: صدر دجاج + أرز" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="السعرات" required>
                    <Input type="number" value={form.calories ?? ''} onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })} required />
                  </Field>
                  <Field label="البروتين (جم)">
                    <Input type="number" value={form.proteinG ?? ''} onChange={(e) => setForm({ ...form, proteinG: Number(e.target.value) })} />
                  </Field>
                  <Field label="الكربوهيدرات (جم)">
                    <Input type="number" value={form.carbsG ?? ''} onChange={(e) => setForm({ ...form, carbsG: Number(e.target.value) })} />
                  </Field>
                  <Field label="الدهون (جم)">
                    <Input type="number" value={form.fatG ?? ''} onChange={(e) => setForm({ ...form, fatG: Number(e.target.value) })} />
                  </Field>
                </div>
                <Field label="الماء المصاحب (مل، اختياري)">
                  <Input type="number" value={form.waterMl ?? ''} onChange={(e) => setForm({ ...form, waterMl: Number(e.target.value) })} placeholder="مثال: 250" />
                </Field>
                <Field label="نوع الوجبة">
                  <Select value={form.mealType ?? ''} onChange={(e) => setForm({ ...form, mealType: e.target.value })}>
                    <option value="">— اختر —</option>
                    {/* Object.entries: نجول على قاموس MEAL_TYPES ونعرض كل نوع كخيار */}
                    {Object.entries(MEAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
              </>
            )}

            {/* type === 'water': أزرار سريعة 250/500 + حقل كمية */}
            {type === 'water' && (
              <Field label="الكمية (مل)" required>
                <div className="flex gap-2">
                  {[250, 500].map((q) => (
                    <button key={q} type="button" onClick={() => setForm({ ...form, amountMl: q })} className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-colors', form.amountMl === q ? 'border-lagoon-500 bg-lagoon-500/10 text-lagoon-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {q} مل
                    </button>
                  ))}
                  <Input type="number" className="w-24" value={form.amountMl ?? ''} onChange={(e) => setForm({ ...form, amountMl: Number(e.target.value) })} placeholder="كمية" required />
                </div>
              </Field>
            )}

            {/* type === 'training': نوع التمرين + مدة + مسافة */}
            {type === 'training' && (
              <>
                <Field label="نوع التمرين" required>
                  <Select value={form.sessionType ?? 'swim'} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}>
                    <option value="swim">سباحة</option>
                    <option value="gym">لياقة / جيم</option>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="المدة (دقيقة)">
                    <Input type="number" value={form.durationMin ?? ''} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
                  </Field>
                  <Field label="المسافة (م)">
                    <Input type="number" value={form.distanceM ?? ''} onChange={(e) => setForm({ ...form, distanceM: Number(e.target.value) })} />
                  </Field>
                </div>
              </>
            )}

            {/* type === 'recovery': نوم + مستويات + وزن اختياري */}
            {type === 'recovery' && (
              <>
                <Field label="ساعات النوم">
                  <Input type="number" step={0.5} min={0} max={24} value={form.sleepHours ?? ''} onChange={(e) => setForm({ ...form, sleepHours: Number(e.target.value) })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {/* map: حقل لكل مستوى (طاقة/جوع/إجهاد/استشفاء) */}
                  {['energyLevel', 'hungerLevel', 'stressLevel', 'recoveryLevel'].map((k) => (
                    <Field key={k} label={levelLabel(k)}>
                      <Select value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}>
                        <option value="">—</option>
                        {/* 10 قيم ممكنة 1..10 */}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
                <Field label="الوزن اليوم (اختياري)">
                  <Input type="number" step={0.1} value={form.weightKg ?? ''} onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })} />
                </Field>
              </>
            )}

            {/* type === 'weight': وزن فقط */}
            {type === 'weight' && (
              <Field label="الوزن (كجم)" required>
                <Input type="number" step={0.1} min={15} max={400} value={form.weightKg ?? ''} onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })} required />
              </Field>
            )}

            {/* ملاحظات الاستشفاء (للنوم فقط) */}
            {type === 'recovery' && (
              <Textarea placeholder="ملاحظات الاستشفاء…" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            )}

            <Button type="submit" className="w-full">حفظ الإدخال</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// levelLabel: ترجمة أسماء المستويات إلى نصوص عربية معروضة.
function levelLabel(k: string): string {
  return {
    energyLevel: 'مستوى الطاقة',
    hungerLevel: 'مستوى الجوع',
    stressLevel: 'مستوى الإجهاد',
    recoveryLevel: 'مستوى الاستشفاء',
  }[k] ?? k;
}
