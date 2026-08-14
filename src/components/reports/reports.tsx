/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/reports/reports.tsx

وظيفة الملف:
صفحة التقارير — تعرض ملخص الأداء الغذائي والتدريبي للسباح
خلال فترة قابلة للاختيار (7/14/30 يوم):
- إحصاءات: سعرات، ماء، تدريب (سباحة/جيم)، متوسط النوم.
- رسم يومي للسعرات مقابل الهدف (مع نسبة الالتزام).
- شريط المغذيات الأساسية (بروتين/كربوهيدرات/دهون).
- تغيّر الوزن خلال الفترة.
- الخطة الحالية مع روابط عرضها وتحميل PDF.
- بطاقة نصائح ملخصّة.

لماذا نحتاجه؟
هذه هي "صورة الإنجاز" — تساعد السباح والكوتش على رؤية
الالتزام والتقدّم واتخاذ قرارات التعديل.

'use client':
يعمل في المتصفح لأنه يجلب البيانات عبر fetch ويتفاعل مع
اختيار الفترة.

متى يعمل؟
عند فتح /reports.

من يستدعي هذا الملف؟
src/app/reports/page.tsx.

الملفات التي يتعامل معها:
- API: /api/reports?days=N (GET — إحصاءات وتقارير).
- مكوّنات: Button، Card/Badge/EmptyState/ProgressBar من ui.
- lib/utils (formatNumber لتنسيق الأرقام).
- next/link للروابط الداخلية (الخطة و PDF).

ترتيب العمل:
1. نفتح الصفحة → نجلب تقرير آخر 7 أيام ↓
2. المستخدم يختار الفترة (7/14/30) → جلب جديد ↓
3. نعرض الإحصاءات والرسوم والنصائح ↓
4. لو لا توجد بيانات → رسالة فارغة مع زر للبدء
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (جلب عند التغيير)، useMemo (حساب أقصى هدف)، useState (الحالة).
import { useEffect, useMemo, useState } from 'react';
// أيقونات الإحصاءات والتنقل.
import {
  Flame,
  Droplets,
  Dumbbell,
  Moon,
  Weight,
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Utensils,
} from 'lucide-react';
// Link: روابط داخلية (الخطة و PDF).
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, Badge, EmptyState, ProgressBar } from '@/components/ui';
import { formatNumber } from '@/lib/utils';

// أسماء أيام الأسبوع المختصرة بالعربية (الترتيب: من الأحد).
const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// ========================================
// 2. المكوّن الرئيسي: Reports
// ========================================

export function Reports() {
  // data: كامل استجابة التقارير من الخادم.
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // days: عدد أيام الفترة المحددة (افتراضي 7).
  const [days, setDays] = useState(7);

  // load: جلب التقرير من الخادم للفترة المطلوبة.
  const load = async (d: number) => {
    setLoading(true);
    const res = await fetch(`/api/reports?days=${d}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  // كلما تغيّرت الفترة نجلب البيانات من جديد.
  useEffect(() => {
    load(days);
  }, [days]);

  // maxCal: أكبر هدف يومي في الرسم — لضبط عرض الأعمدة بالنسبة له.
  const maxCal = useMemo(() => Math.max(...(data?.dailyCalories ?? []).map((d: any) => d.target), 100), [data]);

  // أثناء أول تحميل: رسالة تجهيز.
  if (loading && !data) {
    return <Card><p className="py-12 text-center text-sm text-slate-400">جارٍ تجهيز التقرير…</p></Card>;
  }

  // لا توجد أهداف بعد (لم يحسب الاحتياجات): رسالة فارغة مع زر البدء.
  if (!data || !data.targets) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="لا توجد بيانات كافية"
        description="أكمل ملف السباح واحسب الاحتياجات ثم سجّل أيامًا من الطعام والماء والتدريب ليعرض النظام تقريرًا مفيدًا."
        action={<Link href="/swimmer-profile" className="btn-primary">إدخال البيانات</Link>}
      />
    );
  }

  const stats = data.totals;

  return (
    <div>
      {/* ترويسة الصفحة + أزرار اختيار الفترة */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">التقارير</h1>
          <p className="mt-1 text-sm text-slate-500">ملخص الأداء الغذائي والتدريبي لفترة معينة.</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={
                'rounded-xl border px-4 py-2 text-sm font-bold transition-colors ' +
                (days === d ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
              }
            >
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      {/* بطاقات الإحصاءات الأربع */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Flame className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">سعرات مستهلكة</p>
            <p className="text-xl font-black text-ocean-900">{formatNumber(stats.calories)} <span className="text-xs font-semibold text-slate-400">/ {formatNumber(data.targets.calories ?? 0)} يوميًا</span></p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lagoon-100 text-lagoon-600"><Droplets className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">ماء (لتر)</p>
            <p className="text-xl font-black text-ocean-900">{formatNumber(stats.water / 1000, 2)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-600"><Dumbbell className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">تدريب</p>
            <p className="text-xl font-black text-ocean-900">{stats.sessions} <span className="text-xs font-semibold text-slate-400">جلسات</span></p>
            <p className="text-xs text-slate-400">سباحة {stats.swimMinutes} د · جيم {stats.gymMinutes} د</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-300/40 text-gold-600"><Moon className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-slate-500">متوسط النوم</p>
            <p className="text-xl font-black text-ocean-900">{formatNumber(stats.avgSleep, 1)} <span className="text-xs font-semibold text-slate-400">ساعة</span></p>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* رسم السعرات اليومية مقابل الهدف */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ocean-900">السعرات يوميًا مقابل الهدف</h2>
            <Badge color={data.adherencePct >= 70 ? 'green' : data.adherencePct >= 40 ? 'gold' : 'red'}>
              التزام {data.adherencePct}٪
            </Badge>
          </div>
          <div className="space-y-2">
            {data.dailyCalories.map((d: any, i: number) => {
              const day = new Date(d.date);
              // تجاوز واضح للهدف (أكثر من 115٪) / أقل من 60٪ من الهدف.
              const over = d.consumed > d.target * 1.15;
              const under = d.consumed < d.target * 0.6 && d.consumed > 0;
              return (
                <div key={d.date} className="flex items-center gap-3">
                  {/* اسم اليوم وتاريخه */}
                  <span className="w-14 shrink-0 text-xs font-bold text-slate-500">
                    {DAY_SHORT[day.getDay()]} {day.getDate()}
                  </span>
                  {/* الشريط: الأزرق = المستهلك، الخط الذهبي = الهدف */}
                  <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className="absolute inset-y-0 right-0 rounded-lg bg-ocean-500/90"
                      style={{ width: `${Math.min(100, (d.consumed / maxCal) * 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-1 w-0.5 bg-gold-500"
                      style={{ right: `${Math.min(100, (d.target / maxCal) * 100)}%` }}
                      title={`الهدف ${formatNumber(d.target)}`}
                    />
                  </div>
                  {/* الرقم — أحمر لو تجاوز، كهرماني لو أقل، رمادي عادي */}
                  <span className={`w-16 shrink-0 text-left text-xs font-bold ${over ? 'text-red-600' : under ? 'text-amber-600' : 'text-slate-600'}`}>
                    {d.consumed === 0 ? '—' : formatNumber(d.consumed)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">الخط الذهبي = الهدف اليومي · الأزرق = المستهلك</p>
        </Card>

        <div className="space-y-5">
          {/* المغذيات الأساسية */}
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">المغذيات الأساسية ({days} يوم)</h2>
            <div className="space-y-3">
              {[
                { label: 'بروتين', val: stats.protein, target: data.targets.proteinG, unit: 'جم', color: 'ocean' as const },
                { label: 'كربوهيدرات', val: stats.carbs, target: data.targets.carbsG, unit: 'جم', color: 'gold' as const },
                { label: 'دهون', val: stats.fat, target: data.targets.fatG, unit: 'جم', color: 'green' as const },
              ].map((m) => (
                <div key={m.label}>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                    <span>{m.label}</span>
                    <span>{formatNumber(m.val)} / {formatNumber(m.target ?? 0)} {m.unit}</span>
                  </div>
                  {/* النسبة = المستهلك ÷ (الهدف × عدد الأيام) */}
                  <ProgressBar value={m.target ? (m.val / (m.target * days)) * 100 : 0} color={m.color} />
                </div>
              ))}
            </div>
          </Card>

          {/* تغيّر الوزن */}
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">الوزن</h2>
            {stats.weightFirst != null ? (
              <div>
                <p className="flex items-center gap-2 text-2xl font-black text-ocean-900">
                  {formatNumber(stats.weightLast, 1)} كجم
                  {/* زيادة → أحمر، نقصان → أخضر */}
                  <span className={`flex items-center text-sm font-bold ${(stats.weightChange ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {(stats.weightChange ?? 0) > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatNumber(Math.abs(stats.weightChange ?? 0), 1)} كجم
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">من {formatNumber(stats.weightFirst, 1)} كجم بداية الفترة</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">لا توجد قياسات وزن مسجلة.</p>
            )}
          </Card>

          {/* الخطة الحالية */}
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">الخطة الحالية</h2>
            {data.plan ? (
              <div>
                <p className="text-sm font-bold text-slate-800">{data.plan.title}</p>
                <p className="text-xs text-slate-500">{formatNumber(data.plan.totalCalories ?? 0)} سعرة يوميًا</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/plan/${data.plan.id}`} className="btn-secondary !px-3 !py-1.5 !text-xs">عرض الخطة</Link>
                  <Link href={`/api/plan/${data.plan.id}/pdf`} target="_blank" className="btn-secondary !px-3 !py-1.5 !text-xs">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">لا توجد خطة نشطة.</p>
            )}
          </Card>
        </div>
      </div>

      {/* بطاقة النصائح الختامية */}
      <div className="mt-5">
        <Card className="bg-gradient-to-br from-ocean-700 to-ocean-950 text-white">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold"><Utensils className="h-5 w-5 text-gold-300" /> خلاصة النصائح</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ocean-100">
            <li>• {data.targets.calories ? `التزم بنطاق ${formatNumber(data.targets.calorieMin ?? 0)}–${formatNumber(data.targets.calorieMax ?? 0)} سعرة يوميًا حسب حالة التدريب.` : 'احسب احتياجاتك أولًا للحصول على نصائح أدق.'}</li>
            <li>• البروتين هو الأولوية للسباح: وازع تناوله على 4–5 وجبات يوميًا بمعدل {formatNumber(data.targets.proteinG ? data.targets.proteinG / 4 : 30, 0)} جم تقريبًا لكل وجبة.</li>
            <li>• الماء: لا تنتظر العطش. اشرب {formatNumber(data.targets.waterMl ? data.targets.waterMl / 1000 : 3, 1)} لترًا يوميًا + 500 مل إضافية لكل ساعة سباحة.</li>
            <li>• النوم 8+ ساعات جزء من الخطة — هو الوقت الذي يستشفى فيه العضل.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
