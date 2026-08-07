import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { SwimmerProfileForm } from '@/components/profile/swimmer-profile-form';
import { Card } from '@/components/ui';
import type { SwimmerFormData } from '@/types';

export const metadata = { title: 'ملف السباح' };

export default async function SwimmerProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const initial: SwimmerFormData | null = profile
    ? {
        fullName: profile.fullName,
        gender: profile.gender,
        birthDate: profile.birthDate?.toISOString().slice(0, 10),
        heightCm: profile.heightCm ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        targetWeightKg: profile.targetWeightKg ?? undefined,
        bodyFatPercent: profile.bodyFatPercent ?? undefined,
        waistCm: profile.waistCm ?? undefined,
        country: profile.country ?? undefined,
        timezone: profile.timezone ?? undefined,
        ageGroup: profile.ageGroup ?? undefined,
        swimmerLevel: profile.swimmerLevel ?? undefined,
        specialty: profile.specialty ?? undefined,
        mainDistances: profile.mainDistances ?? undefined,
        personalBests: profile.personalBests ?? undefined,
        nextCompetitionDate: profile.nextCompetitionDate?.toISOString().slice(0, 10),
        swimSessionsPerWeek: profile.swimSessionsPerWeek ?? undefined,
        swimMinutesPerSession: profile.swimMinutesPerSession ?? undefined,
        trainingIntensity: profile.trainingIntensity ?? undefined,
        swimDistancePerSession: profile.swimDistancePerSession ?? undefined,
        gymSessionsPerWeek: profile.gymSessionsPerWeek ?? undefined,
        gymMinutesPerSession: profile.gymMinutesPerSession ?? undefined,
        gymType: profile.gymType ?? undefined,
        restDays: profile.restDays ?? undefined,
        trainingTime: profile.trainingTime ?? undefined,
        hasDoubleTraining: profile.hasDoubleTraining,
        sleepHours: profile.sleepHours ?? undefined,
        dailyActivityLevel: profile.dailyActivityLevel ?? undefined,
        goal: profile.goal ?? undefined,
        allergies: profile.allergies ?? undefined,
        dislikedFoods: profile.dislikedFoods ?? undefined,
        dietType: profile.dietType ?? undefined,
        preferredMealsPerDay: profile.preferredMealsPerDay ?? undefined,
        budgetLevel: profile.budgetLevel ?? undefined,
        availableFoods: profile.availableFoods ?? undefined,
        chronicConditions: profile.chronicConditions ?? undefined,
        medications: profile.medications ?? undefined,
        currentInjuries: profile.currentInjuries ?? undefined,
        digestiveIssues: profile.digestiveIssues ?? undefined,
        pregnancyStatus: profile.pregnancyStatus ?? undefined,
        isMinor: profile.isMinor,
        guardianName: profile.guardianData
          ? (JSON.parse(profile.guardianData) as { name?: string }).name
          : undefined,
        guardianPhone: profile.guardianData
          ? (JSON.parse(profile.guardianData) as { phone?: string }).phone
          : undefined,
        notes: profile.notes ?? undefined,
      }
    : null;

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">ملف السباح</h1>
        <p className="mt-1 text-sm text-slate-500">
          أدخل بيانات السباح الأساسية والتدريبية والغذائية — تُستخدم لاحقًا في حساب الاحتياجات وإنشاء الخطط.
        </p>
      </div>
      <SwimmerProfileForm initial={initial} />
    </AppShell>
  );
}
