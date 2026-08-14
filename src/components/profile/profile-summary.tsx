/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/profile/profile-summary.tsx

وظيفة الملف:
"ملخص بياناتي" — صفحة عرض كاملة لكل بيانات السباح:
- بطاقة رئيسية: الاسم، الدور، الشارات (ذكر/أنثى، مرحلة، تنبيه طبي).
- إحصائيات سريعة: العمر، الطول، الوزن، البطولة القادمة.
- ملخص سريع (نبذة) بأهم المعلومات.
- أقسام تفصيلية: بيانات أساسية، تدريب، حالة غذائية وصحية،
  ملخص الأسبوع الأخير، آخر قياسات الوزن.
- تنبيه "ملف غير مكتمل" مع زر إكمال البيانات.

لماذا نحتاجه؟
هي الشاشة التي يراجع بها المستخدم (أو المدرب أو الاختصاصي)
كل بيانات السباح في صفحة واحدة واضحة.

'use client':
لا يحتاجها — مكوّن عرض ثابت يستقبل البيانات كـ Props.

متى يعمل؟
في /my-profile (بياناتي) و/الملف الكامل عبر /admin/swimmer/[id].

من يستدعي هذا الملف؟
src/app/my-profile/page.tsx و src/app/admin/swimmer/[id]/page.tsx.

الملفات التي يتعامل معها:
- لا API — يتلقى كل البيانات من الصفحة المستدعية كـ Props.
- lib/utils: calculateAge، formatNumber، formatDate.
- lib/constants: قوائم الترجمة (ROLES، GOALS، SWIMMER_LEVELS...).
- مكونات: Card، Stat، Badge، Alert، UserAvatar.

ترتيب العمل:
1. الصفحة تجهّز البيانات (user، profile، targets، plan، weights، week) ↓
2. نحسب العمر ومؤشر كتلة الجسم ↓
3. نعرض البطاقة الرئيسية + الإحصائيات ↓
4. نعرض الأقسام التفصيلية عبر Row/Section (صفوف تُخفي القيم الفارغة)
==================================================
*/

import Link from 'next/link';
import {
  User,
  Dumbbell,
  HeartPulse,
  CalendarDays,
  Ruler,
  Target,
  Trophy,
  Droplets,
  Flame,
  Activity,
  Scale,
  Pencil,
  FileText,
} from 'lucide-react';import { Card, Stat, Badge, Alert } from '@/components/ui';
import { UserAvatar } from '@/components/ui/user-avatar';
import { calculateAge, formatNumber, formatDate } from '@/lib/utils';
import {
  ROLES,
  AGE_GROUPS,
  SWIMMER_LEVELS,
  SPECIALTIES,
  INTENSITY,
  GYM_TYPES,
  GOALS,
  DIET_TYPES,
  ACTIVITY_LEVELS,
  PLAN_TYPES,
} from '@/lib/constants';

// BMI_CATEGORY: ترجمة فئات مؤشر كتلة الجسم إلى عربية.
const BMI_CATEGORY: Record<string, string> = {
  'underweight': 'نحافة',
  'normal': 'طبيعي',
  'overweight': 'زيادة وزن',
  'obese': 'سمنة',
};

// ========================================
// أنواع البيانات (الـ Props)
// ========================================

// SummaryProfile: ملف السباح الكامل (نفس حقول نموذج الملف).
type SummaryProfile = {
  fullName: string;
  gender: string;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  country: string | null;
  timezone: string | null;
  ageGroup: string | null;
  swimmerLevel: string | null;
  specialty: string | null;
  mainDistances: string | null;
  personalBests: string | null;
  nextCompetitionDate: Date | null;
  swimSessionsPerWeek: number | null;
  swimMinutesPerSession: number | null;
  trainingIntensity: string | null;
  swimDistancePerSession: number | null;
  gymSessionsPerWeek: number | null;
  gymMinutesPerSession: number | null;
  gymType: string | null;
  restDays: string | null;
  trainingTime: string | null;
  hasDoubleTraining: boolean;
  sleepHours: number | null;
  dailyActivityLevel: string | null;
  goal: string | null;
  allergies: string | null;
  dislikedFoods: string | null;
  dietType: string | null;
  preferredMealsPerDay: number | null;
  budgetLevel: string | null;
  availableFoods: string | null;
  chronicConditions: string | null;
  medications: string | null;
  currentInjuries: string | null;
  digestiveIssues: string | null;
  pregnancyStatus: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  medicalAlert: boolean;
};

// Targets: الأهداف المحسوبة (من الحاسبة).
type Targets = {
  bmi: number | null;
  bmiCategory: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  waterMl: number | null;
  tdee: number | null;
};

// WeekSummary: ملخص الأسبوع الأخير من سجلات المتابعة.
type WeekSummary = {
  waterMl: number;
  foodCount: number;
  foodCalories: number;
  trainingCount: number;
  trainingMin: number;
};

// ========================================
// مكوّنات مساعدة صغيرة
// ========================================

// Row: صف واحد (تسمية ← قيمة).
// ذكي: يخفي نفسه تلقائيًا إذا كانت القيمة فارغة (null/''/false).
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  if (typeof value === 'boolean') return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-2 last:border-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="max-w-[70%] text-left text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

// Section: قسم كامل داخل بطاقة — أيقونة + عنوان + صفوف.
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ocean-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">{icon}</span>
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </Card>
  );
}

// ========================================
// المكوّن الرئيسي: ProfileSummary
// ========================================

// ProfileSummary: الملخص الكامل.
// Props:
// - user: بيانات الحساب (اسم/بريد/صورة/دور/تاريخ انضمام).
// - profile: ملف السباح (أو null).
// - targets: الأهداف المحسوبة.
// - plan: الخطة الغذائية الحالية.
// - weights: قياسات الوزن الأخيرة.
// - week: ملخص الأسبوع من السجلات.
// - isOwn: هل هذا حسابي أنا؟ (يؤثر على زر "تعديل الملف").
export function ProfileSummary({
  user,
  profile,
  targets,
  plan,
  weights,
  week,
  isOwn,
}: {
  user: { name: string | null; email: string | null; image: string | null; role: string; createdAt: Date };
  profile: SummaryProfile | null;
  targets: Targets | null;
  plan: { title: string | null; planType: string | null; isActive: boolean; createdAt: Date } | null;
  weights: { date: Date; weightKg: number }[];
  week: WeekSummary;
  isOwn: boolean;
}) {
  // الاسم المعروض: من الملف إن وُجد وإلا من الحساب.
  const name = profile?.fullName || user.name || '—';
  // العمر: نحسبه من تاريخ الميلاد عبر calculateAge.
  const age = profile?.birthDate ? calculateAge(profile.birthDate) : null;
  // مؤشر كتلة الجسم BMI: من الأهداف المحسوبة، أو نحسبه يدويًا
  // (الوزن كجم ÷ مربع الطول بالمتر).
  const bmi = targets?.bmi ?? (profile?.weightKg && profile.heightCm ? profile.weightKg / Math.pow(profile.heightCm / 100, 2) : null);
  const bmiCategory = targets?.bmiCategory ?? null;

  // stats: بطاقات الإحصائيات السريعة الست.
  const stats = [
    { icon: CalendarDays, label: 'العمر', value: age !== null ? `${age} سنة` : '—' },
    {
      icon: Scale,
      label: 'مؤشر كتلة الجسم',
      value: bmi ? `${formatNumber(bmi, 1)}${bmiCategory ? ' · ' + (BMI_CATEGORY[bmiCategory] ?? bmiCategory) : ''}` : '—',
    },
    { icon: Target, label: 'الهدف', value: profile?.goal ? GOALS[profile.goal as keyof typeof GOALS] ?? profile.goal : '—' },
    {
      icon: Trophy,
      label: 'المستوى',
      value: profile?.swimmerLevel ? SWIMMER_LEVELS[profile.swimmerLevel as keyof typeof SWIMMER_LEVELS] ?? profile.swimmerLevel : '—',
    },
    { icon: Flame, label: 'السعرات المستهدفة', value: targets?.calories ? `${formatNumber(targets.calories)} سعرة` : '—' },
    {
      icon: FileText,
      label: 'الخطة الغذائية',
      value: plan?.title ?? 'لا توجد خطة',
    },
  ];

  // summaryLines: سطور "نبذة مختصرة" — نضيف سطرًا لكل معلومة مهمة موجودة.
  const summaryLines: string[] = [];
  if (profile?.weightKg) summaryLines.push(`الوزن الحالي ${formatNumber(profile.weightKg)} كجم${profile.targetWeightKg ? ` والهدف ${formatNumber(profile.targetWeightKg)} كجم` : ''}`);
  if (profile?.heightCm) summaryLines.push(`الطول ${formatNumber(profile.heightCm)} سم`);
  if (profile?.swimSessionsPerWeek) summaryLines.push(`يتدرب ${profile.swimSessionsPerWeek} حصص سباحة أسبوعيًا${profile.swimMinutesPerSession ? ` (${profile.swimMinutesPerSession} دقيقة للحصة)` : ''}`);
  if (targets?.proteinG) summaryLines.push(`البروتين المستهدف ${formatNumber(targets.proteinG)} غ`);
  if (targets?.waterMl) summaryLines.push(`الماء المستهدف ${formatNumber(targets.waterMl, 0)} مل يوميًا`);
  if (plan?.title) summaryLines.push(`الخطة الحالية: ${plan.title}`);
  if (profile?.nextCompetitionDate) summaryLines.push(`البطولة القادمة: ${formatDate(profile.nextCompetitionDate)}`);

  return (
    <div className="space-y-6">
      {/* البطاقة الرئيسية */}
      <Card>
        {/* الشريط العلوي الملون: الدور + زر التعديل */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-l from-ocean-700 via-ocean-800 to-ocean-950 px-5 py-3 text-white">
          <p className="text-sm font-bold text-gold-300">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</p>
          {/* زر التعديل يظهر فقط عندما نعرض حسابنا (isOwn) */}
          {isOwn ? (
            <Link href="/swimmer-profile" className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur transition-colors hover:bg-white/25">
              <Pencil className="h-3.5 w-3.5" />
              تعديل الملف
            </Link>
          ) : null}
        </div>
        {/* الصورة والاسم والشارات */}
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <UserAvatar
            name={name}
            image={user.image}
            size="xl"
            className="h-24 w-24 shrink-0 rounded-full ring-2 ring-ocean-100"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-ocean-900">{name}</h1>
              {/* شارات: الجنس، المرحلة العمرية، التنبيه الطبي */}
              {profile?.gender === 'male' ? <Badge color="slate">ذكر</Badge> : profile?.gender === 'female' ? <Badge color="gold">أنثى</Badge> : null}
              {profile?.ageGroup ? <Badge color="green">{AGE_GROUPS[profile.ageGroup as keyof typeof AGE_GROUPS] ?? profile.ageGroup}</Badge> : null}
              {profile?.medicalAlert ? <Badge color="red">يتطلب مراجعة طبية</Badge> : null}
            </div>
            <p className="mt-1 truncate text-sm text-slate-500" dir="ltr">{user.email}</p>
          </div>
        </div>
        {/* 4 مربعات إحصائية سريعة */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-4">
          <div className="rounded-xl bg-ocean-50/70 p-3 text-center">
            <p className="text-xs font-semibold text-slate-400">العمر</p>
            <p className="mt-1 text-base font-black text-ocean-900">{age !== null ? `${age} سنة` : '—'}</p>
          </div>
          <div className="rounded-xl bg-ocean-50/70 p-3 text-center">
            <p className="text-xs font-semibold text-slate-400">الطول</p>
            <p className="mt-1 text-base font-black text-ocean-900">{profile?.heightCm ? `${formatNumber(profile.heightCm)} سم` : '—'}</p>
          </div>
          <div className="rounded-xl bg-ocean-50/70 p-3 text-center">
            <p className="text-xs font-semibold text-slate-400">الوزن</p>
            <p className="mt-1 text-base font-black text-ocean-900">{profile?.weightKg ? `${formatNumber(profile.weightKg)} كجم` : '—'}</p>
          </div>
          <div className="rounded-xl bg-ocean-50/70 p-3 text-center">
            <p className="text-xs font-semibold text-slate-400">البطولة القادمة</p>
            <p className="mt-1 text-base font-black text-ocean-900">{profile?.nextCompetitionDate ? formatDate(profile.nextCompetitionDate) : '—'}</p>
          </div>
        </div>
        {/* سطر إضافي: الدولة، التخصص، تاريخ الانضمام */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-5 text-xs text-slate-500">
          {profile?.country && <span>🌍 {profile.country}</span>}
          {profile?.specialty && <span>🏊 {SPECIALTIES[profile.specialty as keyof typeof SPECIALTIES] ?? profile.specialty}</span>}
          <span>📅 انضم {formatDate(user.createdAt)}</span>
        </div>
      </Card>

      {/* تنبيه طبي يظهر فوق كل شيء عند وجوده */}
      {profile?.medicalAlert && (
        <Alert variant="danger" title="تنبيه طبي">
          تم تسجيل حالة صحية أو سباح قاصر — الخطط لهذا السباح إرشادية فقط وتتطلب مراجعة اختصاصي تغذية رياضية وطبيب عند الحاجة.
        </Alert>
      )}

      {/* ملخص سريع: بطاقات الإحصائيات الست */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Stat key={s.label} icon={<s.icon className="h-5 w-5" />} label={s.label} value={s.value} />
        ))}
      </div>

      {/* نبذة مختصرة (سطور نقطية) */}
      {summaryLines.length > 0 && (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-ocean-900">
            <Activity className="h-4 w-4 text-ocean-500" />
            نبذة مختصرة
          </h2>
          <ul className="space-y-1.5">
            {summaryLines.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ocean-400" />
                {l}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* البيانات الأساسية */}
      <Section icon={<User className="h-4 w-4" />} title="البيانات الأساسية">
        <Row label="الاسم الكامل" value={profile?.fullName} />
        <Row label="تاريخ الميلاد" value={profile?.birthDate ? formatDate(profile.birthDate) : undefined} />
        <Row label="العمر" value={age !== null ? `${age} سنة` : undefined} />
        <Row label="الطول" value={profile?.heightCm ? `${formatNumber(profile.heightCm)} سم` : undefined} />
        <Row label="الوزن الحالي" value={profile?.weightKg ? `${formatNumber(profile.weightKg)} كجم` : undefined} />
        <Row label="الوزن المستهدف" value={profile?.targetWeightKg ? `${formatNumber(profile.targetWeightKg)} كجم` : undefined} />
        <Row label="نسبة الدهون" value={profile?.bodyFatPercent ? `${formatNumber(profile.bodyFatPercent)}%` : undefined} />
        <Row label="محيط الخصر" value={profile?.waistCm ? `${formatNumber(profile.waistCm)} سم` : undefined} />
        <Row label="الدولة" value={profile?.country} />
        <Row label="المرحلة العمرية" value={profile?.ageGroup ? AGE_GROUPS[profile.ageGroup as keyof typeof AGE_GROUPS] ?? profile.ageGroup : undefined} />
        <Row label="مستوى السباح" value={profile?.swimmerLevel ? SWIMMER_LEVELS[profile.swimmerLevel as keyof typeof SWIMMER_LEVELS] ?? profile.swimmerLevel : undefined} />
        <Row label="التخصص" value={profile?.specialty ? SPECIALTIES[profile.specialty as keyof typeof SPECIALTIES] ?? profile.specialty : undefined} />
        <Row label="المسافات الأساسية" value={profile?.mainDistances} />
        <Row label="الأرقام الشخصية" value={profile?.personalBests} />
        <Row label="البطولة القادمة" value={profile?.nextCompetitionDate ? formatDate(profile.nextCompetitionDate) : undefined} />
      </Section>

      {/* بيانات التدريب */}
      <Section icon={<Dumbbell className="h-4 w-4" />} title="بيانات التدريب">
        <Row label="حصص السباحة أسبوعيًا" value={profile?.swimSessionsPerWeek ?? undefined} />
        <Row label="مدة حصة السباحة" value={profile?.swimMinutesPerSession ? `${profile.swimMinutesPerSession} دقيقة` : undefined} />
        <Row label="شدة التدريب" value={profile?.trainingIntensity ? INTENSITY[profile.trainingIntensity as keyof typeof INTENSITY] ?? profile.trainingIntensity : undefined} />
        <Row label="مسافة التمرين" value={profile?.swimDistancePerSession ? `${formatNumber(profile.swimDistancePerSession)} م` : undefined} />
        <Row label="حصص اللياقة أسبوعيًا" value={profile?.gymSessionsPerWeek ?? undefined} />
        <Row label="مدة حصة اللياقة" value={profile?.gymMinutesPerSession ? `${profile.gymMinutesPerSession} دقيقة` : undefined} />
        <Row label="نوع اللياقة" value={profile?.gymType ? GYM_TYPES[profile.gymType as keyof typeof GYM_TYPES] ?? profile.gymType : undefined} />
        <Row label="أيام الراحة" value={profile?.restDays} />
        <Row label="وقت التدريب" value={profile?.trainingTime} />
        <Row label="تدريب مزدوج" value={profile?.hasDoubleTraining ? 'نعم (صباحًا ومساءً)' : undefined} />
        <Row label="ساعات النوم" value={profile?.sleepHours ?? undefined} />
        <Row label="النشاط اليومي" value={profile?.dailyActivityLevel ? ACTIVITY_LEVELS[profile.dailyActivityLevel as keyof typeof ACTIVITY_LEVELS] ?? profile.dailyActivityLevel : undefined} />
      </Section>

      {/* الغذاء والصحة */}
      <Section icon={<HeartPulse className="h-4 w-4" />} title="الحالة الغذائية والصحية">
        <Row label="الهدف" value={profile?.goal ? GOALS[profile.goal as keyof typeof GOALS] ?? profile.goal : undefined} />
        <Row label="النظام الغذائي" value={profile?.dietType ? DIET_TYPES[profile.dietType as keyof typeof DIET_TYPES] ?? profile.dietType : undefined} />
        <Row label="الوجبات المفضلة يوميًا" value={profile?.preferredMealsPerDay ?? undefined} />
        <Row label="الميزانية" value={profile?.budgetLevel === 'low' ? 'اقتصادية' : profile?.budgetLevel === 'medium' ? 'متوسطة' : profile?.budgetLevel === 'high' ? 'مرتفعة' : undefined} />
        <Row label="الحساسية الغذائية" value={profile?.allergies} />
        <Row label="الأطعمة غير المرغوبة" value={profile?.dislikedFoods} />
        <Row label="الأطعمة المتاحة" value={profile?.availableFoods} />
        <Row label="الأمراض المزمنة" value={profile?.chronicConditions} />
        <Row label="الأدوية" value={profile?.medications} />
        <Row label="الإصابات الحالية" value={profile?.currentInjuries} />
        <Row label="مشكلات الجهاز الهضمي" value={profile?.digestiveIssues} />
        <Row label="الحمل/الرضاعة" value={profile?.pregnancyStatus === 'pregnant' ? 'حامل' : profile?.pregnancyStatus === 'lactating' ? 'مرضع' : undefined} />
        <Row label="قاصر" value={profile?.isMinor ? 'أقل من 18 عامًا' : undefined} />
        <Row label="ولي الأمر" value={profile?.isMinor ? `${profile.guardianName ?? ''}${profile.guardianPhone ? ' · ' + profile.guardianPhone : ''}` : undefined} />
        <Row label="ملاحظات" value={profile?.notes} />
      </Section>

      {/* ملخص الأسبوع الأخير */}
      <Section icon={<Activity className="h-4 w-4" />} title="ملخص الأسبوع الأخير (سجل المتابعة)">
        <Row label="الماء المسجل" value={week.waterMl ? `${formatNumber(week.waterMl, 0)} مل` : 'لا يوجد تسجيل'} />
        <Row label="وجبات الطعام المسجلة" value={week.foodCount ? `${week.foodCount} وجبة (${formatNumber(week.foodCalories)} سعرة)` : 'لا يوجد تسجيل'} />
        <Row label="تمارين مسجلة" value={week.trainingCount ? `${week.trainingCount} تمرين${week.trainingMin ? ` (${week.trainingMin} دقيقة)` : ''}` : 'لا يوجد تسجيل'} />
      </Section>

      {/* آخر الأوزان */}
      {weights.length > 0 && (
        <Section icon={<Scale className="h-4 w-4" />} title="آخر قياسات الوزن">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {weights.map((w) => (
              <div key={w.date.toISOString()} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-ocean-900">{formatNumber(w.weightKg, 1)} كجم</p>
                <p className="text-[11px] text-slate-400">{formatDate(w.date)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* الوحدات غير المدخلة */}
      {profile && !profile.fullName && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Ruler className="h-6 w-6 text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-700">الملف غير مكتمل</p>
                <p className="text-xs text-slate-400">أدخل بيانات السباح الأساسية والتدريبية والغذائية للحصول على خطط دقيقة.</p>
              </div>
            </div>
            {isOwn && (
              <Link href="/swimmer-profile" className="btn-primary">
                <Droplets className="h-4 w-4" />
                إكمال البيانات
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
