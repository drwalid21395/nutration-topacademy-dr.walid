import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { profileSchema } from '@/lib/validation';
import { calculateAge } from '@/lib/utils';
import { rateLimit, audit } from '@/lib/security';
import { syncToGoogleDrive } from '@/lib/google-sync';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`profile:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }
  const d = parsed.data;

  const birthDate = d.birthDate ? new Date(d.birthDate) : undefined;
  const age = birthDate ? calculateAge(birthDate) : undefined;
  const isMinor = d.isMinor ?? (age !== undefined ? age < 18 : false);

  // كشف الحالات التي تحتاج تنبيهًا طبيًا
  const medicalAlert =
    !!d.chronicConditions ||
    !!d.medications ||
    !!d.currentInjuries ||
    !!d.digestiveIssues ||
    (d.pregnancyStatus && d.pregnancyStatus !== 'none') ||
    isMinor;

  const data = {
    fullName: d.fullName,
    gender: d.gender,
    birthDate: birthDate ?? null,
    age: age ?? null,
    heightCm: d.heightCm ?? null,
    weightKg: d.weightKg ?? null,
    targetWeightKg: d.targetWeightKg ?? null,
    bodyFatPercent: d.bodyFatPercent ?? null,
    waistCm: d.waistCm ?? null,
    country: d.country || null,
    timezone: d.timezone || null,
    ageGroup: d.ageGroup || null,
    swimmerLevel: d.swimmerLevel || null,
    specialty: d.specialty || null,
    mainDistances: d.mainDistances || null,
    personalBests: d.personalBests || null,
    nextCompetitionDate: d.nextCompetitionDate ? new Date(d.nextCompetitionDate) : null,
    swimSessionsPerWeek: d.swimSessionsPerWeek ?? null,
    swimMinutesPerSession: d.swimMinutesPerSession ?? null,
    trainingIntensity: d.trainingIntensity || null,
    swimDistancePerSession: d.swimDistancePerSession ?? null,
    gymSessionsPerWeek: d.gymSessionsPerWeek ?? null,
    gymMinutesPerSession: d.gymMinutesPerSession ?? null,
    gymType: d.gymType || null,
    restDays: d.restDays || null,
    trainingTime: d.trainingTime || null,
    hasDoubleTraining: d.hasDoubleTraining,
    sleepHours: d.sleepHours ?? null,
    dailyActivityLevel: d.dailyActivityLevel || null,
    goal: d.goal || null,
    allergies: d.allergies || null,
    dislikedFoods: d.dislikedFoods || null,
    dietType: d.dietType || null,
    preferredMealsPerDay: d.preferredMealsPerDay ?? null,
    budgetLevel: d.budgetLevel || null,
    availableFoods: d.availableFoods || null,
    chronicConditions: d.chronicConditions || null,
    medications: d.medications || null,
    currentInjuries: d.currentInjuries || null,
    digestiveIssues: d.digestiveIssues || null,
    pregnancyStatus: d.pregnancyStatus || null,
    isMinor,
    guardianData: JSON.stringify({ name: d.guardianName ?? '', phone: d.guardianPhone ?? '' }),
    notes: d.notes || null,
    medicalAlert,
  };

  const existing = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
  });

  let profile;
  if (existing) {
    profile = await prisma.swimmerProfile.update({
      where: { id: existing.id },
      data,
    });
  } else {
    profile = await prisma.swimmerProfile.create({
      data: { userId: user.id, ...data },
    });
  }

  await audit(user.id, 'profile.save', 'SwimmerProfile', profile.id, { medicalAlert });

  syncToGoogleDrive({
    type: 'swimmer-profile',
    data: {
      name: user.name,
      email: user.email,
      fullName: d.fullName,
      age: age ?? null,
      gender: d.gender,
      weightKg: d.weightKg,
      heightCm: d.heightCm,
      bodyFatPercent: d.bodyFatPercent,
      goal: d.goal,
      swimmerLevel: d.swimmerLevel,
      specialty: d.specialty,
      mainDistances: d.mainDistances,
      chronicConditions: d.chronicConditions,
      medicalAlert,
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    profile,
    medicalAlert,
    message: 'تم حفظ بيانات السباح بنجاح',
  });
}
