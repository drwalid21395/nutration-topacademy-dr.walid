import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { ProfileSummary } from '@/components/profile/profile-summary';

export const metadata = { title: 'ملخص بياناتي' };

const DAYS_MS = 24 * 60 * 60 * 1000;

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  // الأدمن يستطيع عرض ملخص أي سباح عبر ?userId=
  let targetUserId = user.id;
  let isOwn = true;
  if (user.role === 'admin' && sp.userId && sp.userId !== user.id) {
    const target = await prisma.user.findUnique({
      where: { id: sp.userId },
      select: { id: true, role: true },
    });
    if (target && target.role === 'athlete') {
      targetUserId = target.id;
      isOwn = false;
    }
  }

  const weekStart = new Date(Date.now() - 6 * DAYS_MS);

  const [userRow, profile, targets, plan, weights, waterAgg, foodAgg, trainingAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, image: true, role: true, status: true, createdAt: true },
    }),
    prisma.swimmerProfile.findFirst({
      where: { userId: targetUserId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId: targetUserId } },
      orderBy: { createdAt: 'desc' },
      select: {
        bmi: true,
        bmiCategory: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        waterMl: true,
        tdee: true,
      },
    }),
    prisma.mealPlan.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, planType: true, isActive: true, createdAt: true },
    }),
    prisma.weightLogEntry.findMany({
      where: { userId: targetUserId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { date: true, weightKg: true },
    }),
    prisma.waterLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _sum: { amountMl: true },
    }),
    prisma.foodLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _count: { _all: true },
      _sum: { calories: true },
    }),
    prisma.trainingLogEntry.aggregate({
      where: { userId: targetUserId, date: { gte: weekStart } },
      _count: { _all: true },
      _sum: { durationMin: true },
    }),
  ]);

  if (!userRow || userRow.status === 'deleted') redirect('/dashboard');

  let guardianName: string | null = null;
  let guardianPhone: string | null = null;
  if (profile?.guardianData) {
    try {
      const g = JSON.parse(profile.guardianData) as { name?: string; phone?: string };
      guardianName = g.name ?? null;
      guardianPhone = g.phone ?? null;
    } catch {
      // تجاهل بيانات غير صالحة
    }
  }

  return (
    <AppShell user={user}>
      {!isOwn && (
        <div className="mb-6">
          <h1 className="text-2xl font-black text-ocean-900">ملخص السباح</h1>
          <p className="mt-1 text-sm text-slate-500">جميع بيانات السباح وملخص حالته في صفحة واحدة — كعرض للدكتور.</p>
        </div>
      )}
      <ProfileSummary
        user={{
          name: userRow.name,
          email: userRow.email,
          image: userRow.image,
          role: userRow.role,
          createdAt: userRow.createdAt,
        }}
        profile={
          profile
            ? {
                fullName: profile.fullName,
                gender: profile.gender,
                birthDate: profile.birthDate,
                heightCm: profile.heightCm,
                weightKg: profile.weightKg,
                targetWeightKg: profile.targetWeightKg,
                bodyFatPercent: profile.bodyFatPercent,
                waistCm: profile.waistCm,
                country: profile.country,
                timezone: profile.timezone,
                ageGroup: profile.ageGroup,
                swimmerLevel: profile.swimmerLevel,
                specialty: profile.specialty,
                mainDistances: profile.mainDistances,
                personalBests: profile.personalBests,
                nextCompetitionDate: profile.nextCompetitionDate,
                swimSessionsPerWeek: profile.swimSessionsPerWeek,
                swimMinutesPerSession: profile.swimMinutesPerSession,
                trainingIntensity: profile.trainingIntensity,
                swimDistancePerSession: profile.swimDistancePerSession,
                gymSessionsPerWeek: profile.gymSessionsPerWeek,
                gymMinutesPerSession: profile.gymMinutesPerSession,
                gymType: profile.gymType,
                restDays: profile.restDays,
                trainingTime: profile.trainingTime,
                hasDoubleTraining: profile.hasDoubleTraining,
                sleepHours: profile.sleepHours,
                dailyActivityLevel: profile.dailyActivityLevel,
                goal: profile.goal,
                allergies: profile.allergies,
                dislikedFoods: profile.dislikedFoods,
                dietType: profile.dietType,
                preferredMealsPerDay: profile.preferredMealsPerDay,
                budgetLevel: profile.budgetLevel,
                availableFoods: profile.availableFoods,
                chronicConditions: profile.chronicConditions,
                medications: profile.medications,
                currentInjuries: profile.currentInjuries,
                digestiveIssues: profile.digestiveIssues,
                pregnancyStatus: profile.pregnancyStatus,
                isMinor: profile.isMinor,
                guardianName,
                guardianPhone,
                notes: profile.notes,
                medicalAlert: profile.medicalAlert,
              }
            : null
        }
        targets={
          targets
            ? {
                bmi: targets.bmi,
                bmiCategory: targets.bmiCategory,
                calories: targets.calories,
                proteinG: targets.proteinG,
                carbsG: targets.carbsG,
                fatG: targets.fatG,
                waterMl: targets.waterMl,
                tdee: targets.tdee,
              }
            : null
        }
        plan={
          plan
            ? { title: plan.title, planType: plan.planType, isActive: plan.isActive, createdAt: plan.createdAt }
            : null
        }
        weights={weights}
        week={{
          waterMl: waterAgg._sum.amountMl ?? 0,
          foodCount: foodAgg._count._all,
          foodCalories: foodAgg._sum.calories ?? 0,
          trainingCount: trainingAgg._count._all,
          trainingMin: trainingAgg._sum.durationMin ?? 0,
        }}
        isOwn={isOwn}
      />
    </AppShell>
  );
}
