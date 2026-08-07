import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPlanPdf } from '@/services/pdf/plan-pdf';
import { formatDate, formatNumber } from '@/lib/utils';
import { SWIMMER_LEVELS, GOALS, PLAN_TYPES } from '@/lib/constants';
import { saveReportToDrive } from '@/lib/google-sync';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { id } = await ctx.params;

  const plan = await prisma.mealPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } },
      user: { select: { name: true, image: true } },
    },
  });

  if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 });

  const profile = plan.profileId
    ? await prisma.swimmerProfile.findUnique({ where: { id: plan.profileId } })
    : null;

  const url = new URL(req.url);
  const brief = url.searchParams.get('mode') === 'brief';
  const includeSupplements = url.searchParams.get('supplements') === '1';

  const shopping = new Set<string>();
  const safetyNotes = [
    'احفظ اللحوم والدواجن المطبوخة في الثلاجة (4°م أو أقل) واستهلكها خلال 3-4 أيام.',
    'لا تترك الطعام في درجة حرارة الغرفة أكثر من ساعتين.',
    'أعد تسخين الوجبات المجمدة حتى تصل لحرارة عالية قبل الأكل.',
    'افصل اللحوم النيئة عن المطبوخة لمنع التلوث المتبادل.',
  ];

  const meals = plan.meals
    .filter((m) => (brief ? m.dayNumber === 1 : true))
    .map((m) => ({
      day: m.dayNumber,
      type: m.mealType,
      title: m.title,
      timing: m.timing ?? '',
      calories: m.calories,
      items: m.items
        .filter((it) => !it.isAlternative)
        .map((it) => {
          shopping.add(it.foodNameAr);
          return { name: it.foodNameAr, qty: it.quantity ?? `${it.grams ?? ''} جم`, cals: Math.round(it.calories ?? 0) };
        }),
    }));

  const supplementNames = includeSupplements
    ? ['تثقيفي فقط: البروتين، الكرياتين (للبالغين بإشراف مختص)، الكافيين (بحذر)، الإلكتروليتات، فيتامين D والحديد (عند نقص مثبت بالفحص)، أوميجا 3، الكالسيوم، المغنيسيوم.']
    : [];

  const pdfData = {
    swimmerName: profile?.fullName ?? plan.user.name ?? '',
    issueDate: formatDate(plan.createdAt),
    planDuration: PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? `${plan.durationDays} يوم`,
    goal: plan.goal ? GOALS[plan.goal as keyof typeof GOALS] ?? plan.goal : undefined,
    gender: profile?.gender === 'female' ? 'أنثى' : 'ذكر',
    age: profile?.age ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    level: profile?.swimmerLevel ? SWIMMER_LEVELS[profile.swimmerLevel as keyof typeof SWIMMER_LEVELS] : undefined,
    swimSessions: profile?.swimSessionsPerWeek ?? null,
    gymSessions: profile?.gymSessionsPerWeek ?? null,
    calories: plan.totalCalories,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    waterMl: plan.waterMl,
    meals,
    shoppingList: Array.from(shopping),
    alternativesNote: 'يمكن استبدال أي مكوّن ببديل مماثل من نفس المجموعة الغذائية مع مراعاة الحساسية المسجلة والنظام الغذائي المختار.',
    competitionNotes: plan.isCompetitionMode
      ? [
          'الأسبوع السابق: ثبّت مواعيد الوجبات ولا تجرّب أطعمة أو مكملات جديدة.',
          'قبل السباق بـ 3-4 ساعات: وجبة مألوفة منخفضة الدهون والألياف.',
          'بين السباقات: وجبات صغيرة سريعة الهضم وتعويض السوائل.',
          'بعد كل سباق: بروتين + كربوهيدرات سريعة خلال 30 دقيقة.',
        ]
      : undefined,
    safetyNotes,
    version: `1.${plan.version}`,
    planUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/plan/${plan.id}`,
    includeSupplements,
    supplementsSection: supplementNames,
  };

  try {
    const pdf = await buildPlanPdf(pdfData);
    saveReportToDrive({
      swimmerName: profile?.fullName ?? plan.user.name ?? 'سباح',
      kind: 'plan',
      fileName: `plan-${plan.id}.pdf`,
      mimeType: 'application/pdf',
      base64: pdf.toString('base64'),
    }).catch(() => {});
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="plan-${plan.id}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'تعذر إنشاء PDF' },
      { status: 500 }
    );
  }
}
