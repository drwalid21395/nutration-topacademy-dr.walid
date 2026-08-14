/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/profile/route.ts

وظيفة الملف:
واجهة API لملف السباح الغذائي:
- GET: جلب ملف السباح المحفوظ من جدول SwimmerProfile.
- POST: حفظ/تحديث ملف السباح (إن وُجد سجل نحدّثه، وإلا ننشئه)،
  مع كشف الحالات الطبية التي تحتاج تنبيهًا (medicalAlert).

لماذا نحتاجه؟
صفحة "بيانات السباح" تعتمد عليها: تعرض البيانات عند الدخول
(GET) وتحفظ كل ما أدخله المستخدم (POST) — وكل الحسابات
الغذائية تنطلق من هذا الملف.

متى يعمل؟
عند GET/POST إلى /api/profile.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (POST) هل أرسل طلبات كثيرة؟ → 429.
3. (POST) نفحص البيانات بـ zod (profileSchema) → 422 لو غير صالحة.
4. نحسب العمر ونحدد هل المستخدم قاصر (أقل من 18).
5. نكشف الحالات الطبية (حساسية/أدوية/إصابات/حمل/قاصر).
6. نحفظ الملف (تحديث أو إنشاء) في جدول SwimmerProfile.
7. نسجل العملية (audit) ونرفع نسخة للتوثيق في Google Drive.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: بيانات غير مكتملة/غير صحيحة.
- 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- profileSchema من lib/validation (قاعدة فحص zod).
- calculateAge من lib/utils.
- rateLimit + audit من lib/security.
- syncToGoogleDrive من lib/google-sync.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// profileSchema: من lib/validation — قواعد التحقق من بيانات
// الملف عبر zod (تضمن صحة القيم قبل الحفظ).
import { profileSchema } from '@/lib/validation';
// calculateAge: من lib/utils — دالة تحسب العمر من تاريخ الميلاد.
import { calculateAge } from '@/lib/utils';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';
// syncToGoogleDrive: من lib/google-sync — نسخة توثيقية للملف في درايف.
import { syncToGoogleDrive } from '@/lib/google-sync';

// ========================================
// 2. معالج الطلب GET (جلب الملف)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نجلب ملف السباح (أحدث ملف محفوظ للمستخدم).
  // findFirst: أول سجل يطابق الشرط، مرتبًا بالأحدث تعديلًا.
  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ profile });
}

// ========================================
// 3. معالج الطلب POST (حفظ الملف)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
// req: كائن الطلب الواصل (يحوي كل بيانات ملف السباح).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 30 طلبًا في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`profile:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: التحقق من البيانات عبر zod.
  // safeParse: لا يرمي خطأً بل يعيد نتيجة؛ لو فشلت نرجع أول رسالة خطأ.
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }
  // d = البيانات التي اجتازت الفحص (موثوقة الآن).
  const d = parsed.data;

  // الخطوة 5: حسابات مساعدة من تاريخ الميلاد.
  // العمر من تاريخ الميلاد، وقاصر = أقل من 18 سنة.
  const birthDate = d.birthDate ? new Date(d.birthDate) : undefined;
  const age = birthDate ? calculateAge(birthDate) : undefined;
  const isMinor = d.isMinor ?? (age !== undefined ? age < 18 : false);

  // الخطوة 6: كشف الحالات التي تحتاج تنبيهًا طبيًا
  // (أي شرط يشير إلى حالة طبية = medicalAlert: true).
  // كشف الحالات التي تحتاج تنبيهًا طبيًا
  const medicalAlert =
    !!d.chronicConditions ||
    !!d.medications ||
    !!d.currentInjuries ||
    !!d.digestiveIssues ||
    (d.pregnancyStatus && d.pregnancyStatus !== 'none') ||
    isMinor;

  // الخطوة 7: تجهيز بيانات الحفظ.
  // نمرر القيم من zod إلى قاعدة البيانات مع تعبئة كل حقل فارغ بـ null
  // (لأن قاعدة البيانات تفضل null على قيمة غير معرفة).
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
    // بيانات ولي الأمر تُخزَّن ككائن JSON واحد.
    guardianData: JSON.stringify({ name: d.guardianName ?? '', phone: d.guardianPhone ?? '' }),
    notes: d.notes || null,
    medicalAlert,
  };

  // الخطوة 8: الحفظ — إن وُجد ملف سابق نحدّثه، وإلا ننشئ ملفًا جديدًا.
  // (مستخدم واحد له ملف واحد عادة، فنستبدل القديم بالجديد).
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

  // الخطوة 9: تسجيل العملية في سجل التدقيق مع حالة التنبيه الطبي.
  await audit(user.id, 'profile.save', 'SwimmerProfile', profile.id, { medicalAlert });

  // الخطوة 10: نسخة توثيقية من الملف في Google Drive (اختيارية).
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

  // الخطوة 11: إرجاع الملف المحفوظ مع حالة التنبيه الطبي.
  return NextResponse.json({
    ok: true,
    profile,
    medicalAlert,
    message: 'تم حفظ بيانات السباح بنجاح',
  });
}
