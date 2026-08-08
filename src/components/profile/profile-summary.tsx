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

const BMI_CATEGORY: Record<string, string> = {
  'underweight': 'نحافة',
  'normal': 'طبيعي',
  'overweight': 'زيادة وزن',
  'obese': 'سمنة',
};

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

type WeekSummary = {
  waterMl: number;
  foodCount: number;
  foodCalories: number;
  trainingCount: number;
  trainingMin: number;
};

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
  const name = profile?.fullName || user.name || '—';
  const age = profile?.birthDate ? calculateAge(profile.birthDate) : null;
  const bmi = targets?.bmi ?? (profile?.weightKg && profile.heightCm ? profile.weightKg / Math.pow(profile.heightCm / 100, 2) : null);
  const bmiCategory = targets?.bmiCategory ?? null;

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
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar name={name} image={user.image} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-ocean-900">{name}</h1>
              <Badge color={user.role === 'admin' ? 'red' : 'ocean'}>{ROLES[user.role as keyof typeof ROLES] ?? user.role}</Badge>
              {profile?.gender === 'male' ? <Badge color="slate">ذكر</Badge> : profile?.gender === 'female' ? <Badge color="gold">أنثى</Badge> : null}
              {profile?.ageGroup ? <Badge color="green">{AGE_GROUPS[profile.ageGroup as keyof typeof AGE_GROUPS] ?? profile.ageGroup}</Badge> : null}
              {profile?.medicalAlert ? <Badge color="red">يتطلب مراجعة طبية</Badge> : null}
            </div>
            <p className="mt-1 truncate text-sm text-slate-500" dir="ltr">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {profile?.country && <span>🌍 {profile.country}</span>}
              {profile?.specialty && <span>🏊 {SPECIALTIES[profile.specialty as keyof typeof SPECIALTIES] ?? profile.specialty}</span>}
              <span>📅 انضم {formatDate(user.createdAt)}</span>
            </div>
          </div>
          {isOwn && (
            <Link href="/swimmer-profile" className="btn-secondary">
              <Pencil className="h-4 w-4" />
              تعديل الملف
            </Link>
          )}
        </div>
      </Card>

      {profile?.medicalAlert && (
        <Alert variant="danger" title="تنبيه طبي">
          تم تسجيل حالة صحية أو سباح قاصر — الخطط لهذا السباح إرشادية فقط وتتطلب مراجعة اختصاصي تغذية رياضية وطبيب عند الحاجة.
        </Alert>
      )}

      {/* ملخص سريع */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Stat key={s.label} icon={<s.icon className="h-5 w-5" />} label={s.label} value={s.value} />
        ))}
      </div>

      {/* نبذة مختصرة */}
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
