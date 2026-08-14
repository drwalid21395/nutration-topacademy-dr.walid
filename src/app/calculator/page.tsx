/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/calculator/page.tsx

وظيفة الملف:
صفحة "حاسبة الاحتياجات الغذائية" (المسار /calculator).
تقرأ بيانات السباح من قاعدة البيانات، تحسب احتياجاته
بمعادلات علمية، وتعرض: السعرات اليومية، الماء،
المغذيات الكبرى، البيانات المحسوبة (BMI...)، التوصيات،
وتوزيع السعرات على الوجبات.

لماذا نحتاجه؟
بعد إدخال ملف السباح، هذه الصفحة تترجم البيانات إلى
أرقام علمية يبني عليها النظام الخطط الغذائية.

نوعها: Server Component (بدون 'use client').
الحساب العلمي ثقيل ويحتاج بيانات المستخدم من قاعدة
البيانات، فنجريه في الخادم قبل إرسال الصفحة (أسرع وأكثر أمانًا).

متى يعمل؟
عند فتح /calculator بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من زر
"إعادة الحساب" في لوحة التحكم.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- summarizeNutrition من services/nutrition (المحرك العلمي).
- AppShell + مكونات UI (Card, Stat, Alert...).
- SaveAndCreatePlan من components/calculator.
- formatNumber من lib/utils.

ترتيب العمل:
1. فحص تسجيل الدخول.
2. جلب ملف السباح؛ لو ناقص الطول/الوزن → رسالة "أدخل البيانات أولًا".
3. حساب الاحتياجات عبر summarizeNutrition.
4. تجهيز صفوف المغذيات للعرض.
5. عرض النتائج والتنبيهات الطبية والتوصيات.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // redirect: نقل لصفحة أخرى — من مكتبة next/navigation.
import Link from 'next/link'; // رابط داخلي (لا يعيد تحميل الصفحة) — من مكتبة next/link.
import { Flame, Droplets, Beef, Wheat, Droplet, Ruler, Activity, Salad } from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.

// ملاحظة:
// يبدو أن بعض الأيقونات المستوردة (Beef, Wheat, Droplet) غير مستخدمة حاليًا في هذا الملف.
// يجب التأكد قبل حذفها.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { SaveAndCreatePlan } from '@/components/calculator/save-and-create-plan'; // زر "حفظ وإنشاء خطة" — ملف محلي.
import { Card, Stat, Alert, Badge, EmptyState } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.
import { summarizeNutrition } from '@/services/nutrition'; // المحرك العلمي: معادلات الحساب والتوصيات والتنبيهات — ملف محلي.
import { formatNumber } from '@/lib/utils'; // دالة تنسيق الأرقام (فواصل الآلاف) — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'حاسبة الاحتياجات' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
دالة: CalculatorPage — تعرض نتائج الحساب الغذائي.
متى تعمل؟ عند فتح /calculator.
خطواتها (قصة البيانات):
1. من هو المستخدم؟ لو لا أحد → صفحة الدخول.
2. جلب ملف السباح من قاعدة البيانات.
3. لو الملف ناقص الطول أو الوزن → رسالة تطلب إدخال البيانات.
4. حساب الاحتياجات عبر المحرك العلمي summarizeNutrition.
5. ترتيب النتائج وعرضها.
*/
export default async function CalculatorPage() {
  // الخطوة 1: من هو المستخدم؟ غير مسجل → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: نجلب ملف السباح (أول ملف لهذا المستخدم).
  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
  });

  // الخطوة 3: لو لا يوجد ملف أو الطول/الوزن فارغان → نطلب إدخالهما أولًا
  // (المحرك لا يستطيع الحساب بدونهما). نعرض حالة فارغة مع زر للانتقال.
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

  // الخطوة 4: الحساب العلمي — نمرر بيانات الملف للمحرك.
  // القيم الاختيارية الناقصة نمررها undefined لتُحسب بقيم افتراضية آمنة.
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

  // summary.result: كل النتائج الرقمية (سعرات، بروتين...). نختصره في r.
  const r = summary.result;

  // macroRows: مصفوفة (Array) لصفوف المغذيات الثلاثة (بروتين/كربو/دهون)
  // مع نسبتها المئوية ولون شريط التقدم — نرسمها بحلقة map.
  const macroRows = [
    { label: 'البروتين', value: formatNumber(r.proteinG, 1), unit: 'جم', pct: r.proteinPct, color: 'bg-gold-500' },
    { label: 'الكربوهيدرات', value: formatNumber(r.carbsG, 1), unit: 'جم', pct: r.carbsPct, color: 'bg-ocean-500' },
    { label: 'الدهون', value: formatNumber(r.fatG, 1), unit: 'جم', pct: r.fatPct, color: 'bg-lagoon-500' },
  ];

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">حاسبة الاحتياجات الغذائية</h1>
        <p className="mt-1 text-sm text-slate-500">
          النتائج تقديرية مبنية على معادلات علمية (Mifflin-St Jeor + Katch-McArdle) وتحتاج مراجعة اختصاصي، خصوصًا للقاصرين وأصحاب الحالات الصحية.
        </p>
      </div>

      {/* التنبيهات الطبية (إن وجدت): danger=تنبيه هام، warning=ملاحظة.
          المحرك يعيدها في summary.alerts (مثل تنبيهات القاصرين والحالات الصحية). */}
      {summary.alerts.map((a, i) => (
        <div key={i} className="mb-4">
          <Alert variant={a.type} title={a.type === 'danger' ? 'تنبيه هام' : 'ملاحظة'}>{a.message}</Alert>
        </div>
      ))}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ثلاث بطاقات رئيسية: السعرات اليومية، الماء، سعرات التمرين */}
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

          {/* بطاقة المغذيات الكبرى: أشرطة تقدم للبروتين والكربو والدهون + أرقام إضافية */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-ocean-900">المغذيات الكبرى اليومية</h2>
            <div className="space-y-4">
              {/* map: نرسم صفًا لكل مغذي مع شريط تقدم عرضه يساوي النسبة المئوية */}
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

          {/* بطاقة البيانات المحسوبة: BMI والطول والوزن والعمر */}
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

          {/* بطاقة التوصيات: كل مفتاح → عنوان عربي، والقيمة → نص التوصية */}
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">التوصيات</h2>
            <div className="space-y-3">
              {/* Object.entries: يمر على أزواج (مفتاح، قيمة) في كائن التوصيات.
                  k = المفتاح (مثل trainingDay) و v = نص التوصية. */}
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
          {/* توزيع السعرات على الوجبات (كل وجبة والسعرات المخصصة لها) */}
          <Card>
            <h2 className="mb-3 text-base font-bold text-ocean-900">توزيع السعرات على الوجبات</h2>
            <div className="space-y-2.5">
              {/* r.mealCalories: كائن فيه الوجبة → سعراتها. نمر عليه لعرض صف لكل وجبة */}
              {Object.entries(r.mealCalories ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{mealLabel(k)}</span>
                  <b className="text-ocean-800">{formatNumber(v)}</b>
                </div>
              ))}
            </div>
          </Card>

          {/* بطاقة دعوة لإنشاء الخطة الغذائية: زر يحفظ الحساب ثم ينشئ الخطة */}
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

// ========================================
// 5. الدوال المساعدة (تحويل المفاتيح إلى عربي)
// ========================================

// mealLabel: دالة تحوّل مفتاح الوجبة الإنجليزي (مثل breakfast)
// إلى اسم عربي (الفطور). لو المفتاح غير معروف تعيده كما هو.
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

// recommendationLabel: دالة تحوّل مفتاح التوصية الإنجليزي
// (مثل trainingDay) إلى اسم عربي لعرضه في الشارة.
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
