import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Flame, Droplets, Beef, Wheat, Droplet, Ruler, Activity, Salad } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { SaveAndCreatePlan } from '@/components/calculator/save-and-create-plan';
import { Card, Stat, Alert, Badge, EmptyState } from '@/components/ui';
import { summarizeNutrition } from '@/services/nutrition';
import { formatNumber } from '@/lib/utils';

export const metadata = { title: 'حاسبة الاحتياجات' };

export default async function CalculatorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
  });

  if (!profile || !profile.heightCm || !profile.weightKg) {
    return (
      <AppShell user={user}>
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title="البيانات الأساسية ناقصة"
          description="أدخل ملف السباح بالطول والوزن والعمر أولًا ليتمكن المحرك من حساب الاحتياجات."
          action={<Link href="/swimmer-profile" className="btn-primary">إدخال بيانات السباح</Link>}
        />
      </AppShell>
    );
  }

  const summary = summarizeNutrition({
    gender: profile.gender,
    age: profile.age ?? 17,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent ?? undefined,
    goal: profile.goal ?? undefined,
    swimmerLevel: profile.swimmerLevel ?? undefined,
    swimSessionsPerWeek: profile.swimSessionsPerWeek ?? undefined,
    swimMinutesPerSession: profile.swimMinutesPerSession ?? undefined,
    trainingIntensity: profile.trainingIntensity ?? undefined,
    gymSessionsPerWeek: profile.gymSessionsPerWeek ?? undefined,
    gymMinutesPerSession: profile.gymMinutesPerSession ?? undefined,
    gymType: profile.gymType ?? undefined,
    dailyActivityLevel: profile.dailyActivityLevel ?? undefined,
    preferredMealsPerDay: profile.preferredMealsPerDay ?? undefined,
    isMinor: profile.isMinor,
    hasDoubleTraining: profile.hasDoubleTraining,
    nextCompetitionDate: profile.nextCompetitionDate ?? null,
    chronicConditions: profile.chronicConditions ?? undefined,
    allergies: profile.allergies ?? undefined,
    pregnancyStatus: profile.pregnancyStatus ?? undefined,
  });

  const r = summary.result;

  const macroRows = [
    { label: 'البروتين', value: formatNumber(r.proteinG, 1), unit: 'جم', pct: r.proteinPct, color: 'bg-gold-500' },
    { label: 'الكربوهيدرات', value: formatNumber(r.carbsG, 1), unit: 'جم', pct: r.carbsPct, color: 'bg-ocean-500' },
    { label: 'الدهون', value: formatNumber(r.fatG, 1), unit: 'جم', pct: r.fatPct, color: 'bg-lagoon-500' },
  ];

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">حاسبة الاحتياجات الغذائية</h1>
        <p className="mt-1 text-sm text-slate-500">
          النتائج تقديرية مبنية على معادلات علمية (Mifflin-St Jeor + Katch-McArdle) وتحتاج مراجعة اختصاصي، خصوصًا للقاصرين وأصحاب الحالات الصحية.
        </p>
      </div>

      {summary.alerts.map((a, i) => (
        <div key={i} className="mb-4">
          <Alert variant={a.type} title={a.type === 'danger' ? 'تنبيه هام' : 'ملاحظة'}>{a.message}</Alert>
        </div>
      ))}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-gradient-to-br from-ocean-600 to-ocean-800 text-white">
              <Flame className="mb-2 h-7 w-7 text-gold-400" />
              <p className="text-xs font-semibold text-ocean-200">السعرات اليومية المستهدفة</p>
              <p className="mt-1 text-3xl font-black">{formatNumber(r.calories)}</p>
              <p className="mt-1 text-xs text-ocean-200">نطاق آمن: {formatNumber(r.calorieMin)}-{formatNumber(r.calorieMax)}</p>
            </Card>
            <Card>
              <Droplets className="mb-2 h-7 w-7 text-lagoon-500" />
              <p className="text-xs font-semibold text-slate-500">احتياج الماء اليومي</p>
              <p className="mt-1 text-3xl font-black text-ocean-900">{formatNumber((r.waterMl ?? 0) / 1000, 1)} لتر</p>
              <p className="mt-1 text-xs text-slate-500">إضافي أثناء التمرين: {formatNumber(r.trainingWaterMl ?? 0)} مل</p>
            </Card>
            <Card>
              <Activity className="mb-2 h-7 w-7 text-gold-500" />
              <p className="text-xs font-semibold text-slate-500">سعرات التمرين (تقديري/جلسة)</p>
              <p className="mt-1 text-3xl font-black text-ocean-900">{formatNumber(r.trainingCalories?.swimKcal ?? 0)}</p>
              <p className="mt-1 text-xs text-slate-500">سباحة + {formatNumber(r.trainingCalories?.gymKcal ?? 0)} جيم</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-base font-bold text-ocean-900">المغذيات الكبرى اليومية</h2>
            <div className="space-y-4">
              {macroRows.map((m) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{m.label}</span>
                    <span className="text-slate-500">{m.value} {m.unit} · {m.pct}٪</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                <Stat label="الألياف" value={`${formatNumber(r.fiberG, 1)} جم`} />
                <Stat label="الصوديوم (إرشادي)" value={`${formatNumber(r.sodiumMg ?? 0)} ملجم`} />
                <Stat label="معدل الأيض BMR" value={formatNumber(r.bmr)} />
                <Stat label="الإجمالي TDEE" value={formatNumber(r.tdee)} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-bold text-ocean-900">البيانات المحسوبة</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <Ruler className="mx-auto mb-1 h-5 w-5 text-ocean-500" />
                <p className="text-sm font-bold text-ocean-900">{formatNumber(r.bmi, 1)}</p>
                <p className="text-xs text-slate-500">BMI — {r.bmiCategory}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-sm font-bold text-ocean-900">{formatNumber(profile.heightCm)} سم</p>
                <p className="text-xs text-slate-500">الطول</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-sm font-bold text-ocean-900">{formatNumber(profile.weightKg, 1)} كجم</p>
                <p className="text-xs text-slate-500">الوزن</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-sm font-bold text-ocean-900">{profile.age ?? '—'} سنة</p>
                <p className="text-xs text-slate-500">العمر</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">التوصيات</h2>
            <div className="space-y-3">
              {Object.entries(summary.recommendations).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ocean-50/60 p-3">
                  <Badge className="mb-1">{recommendationLabel(k)}</Badge>
                  <p className="text-sm leading-relaxed text-slate-700">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">توزيع السعرات على الوجبات</h2>
            <div className="space-y-2.5">
              {Object.entries(r.mealCalories ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{mealLabel(k)}</span>
                  <b className="text-ocean-800">{formatNumber(v)}</b>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-lagoon-500 to-ocean-700 text-white">
            <Salad className="mb-2 h-8 w-8 text-gold-300" />
            <h3 className="text-lg font-black">جاهز لخطتك الغذائية؟</h3>
            <p className="mt-1 text-sm leading-relaxed text-ocean-100">
              سيُحفظ الحساب في ملف السباح ثم تُنشأ خطة يومية متنوعة مع بدائل وقائمة مشتريات.
            </p>
            <SaveAndCreatePlan />
          </Card>

          <Alert variant="info" title="تنبيه">
            الحسابات تقديرية لأغراض تعليمية. للمنافسين والقاصرين وأصحاب الحالات الصحية، تُراجَع الخطة مع اختصاصي تغذية رياضية معتمد.
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}

function mealLabel(key: string): string {
  const map: Record<string, string> = {
    breakfast: 'الفطور',
    snack1: 'خفيفة صباحية',
    preWorkout: 'قبل التمرين',
    lunch: 'الغداء',
    duringWorkout: 'أثناء التمرين',
    postWorkout: 'بعد التمرين',
    dinner: 'العشاء',
    snack2: 'خفيفة مسائية',
    supper: 'قبل النوم',
  };
  return map[key] ?? key;
}

function recommendationLabel(key: string): string {
  const map: Record<string, string> = {
    trainingDay: 'يوم تدريب',
    restDay: 'يوم راحة',
    doubleTraining: 'تدريب مزدوج',
    competitionWeek: 'أسبوع البطولة',
    competitionDay: 'يوم البطولة',
    postRace: 'بعد السباق',
    fatLoss: 'خفض الدهون',
    muscleGain: 'زيادة الكتلة',
    hydration: 'الترطيب',
    micronutrients: 'العناصر الدقيقة',
    supplements: 'المكملات',
  };
  return map[key] ?? key;
}
