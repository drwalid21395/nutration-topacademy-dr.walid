import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { SupplementAssessmentInput, SupplementAssessmentOutput } from '@/services/supplements/types';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (id) {
    const assessment = await prisma.supplementAssessment.findFirst({
      where: { id, userId: user.id },
      include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
    });
    if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });
    return NextResponse.json({ assessment });
  }

  const assessments = await prisma.supplementAssessment.findMany({
    where: { userId: user.id },
    include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ assessments });
}

/** حفظ تقييم (نتيجة المحرك) مع توصياته */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: { input?: SupplementAssessmentInput; result?: SupplementAssessmentOutput; profileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const result = body.result;
  if (!result) return NextResponse.json({ error: 'نتيجة التقييم مطلوبة' }, { status: 422 });

  const saved = await prisma.supplementAssessment.create({
    data: {
      userId: user.id,
      profileId: body.profileId ?? null,
      version: result.version,
      status: 'needs-review',
      overallLevel: result.overallLevel,
      needsMedicalApproval: result.needsMedicalApproval,
      needsGuardianConsent: result.needsGuardianConsent,
      needsLabTest: result.needsLabTest,
      coverage: JSON.stringify(result.coverage),
      eligibility: JSON.stringify(result.eligibility),
      proteinGap: JSON.stringify(result.proteinGap),
      hydration: JSON.stringify(result.hydration),
      recommendations: JSON.stringify(result.recommendations),
      schedule: JSON.stringify(result.schedule),
      foodAlternatives: JSON.stringify(result.foodAlternatives),
      reassessAt: new Date(Date.now() + 30 * 86400000),
      recommendationItems: {
        create: result.recommendations.map((rec) => ({
          supplementKey: rec.key,
          nameAr: rec.nameAr,
          status: rec.status,
          eligibilityVerdict: rec.verdict,
          evidenceStrength: rec.evidenceStrength,
          coverageFromFood: rec.coverageFromFoodPct,
          deficit: rec.deficit,
          doseEstimate: rec.doseEstimate,
          doseUnit: rec.doseUnit,
          timingAr: rec.timingAr,
          durationDays: rec.durationDays,
          upperLimitWarning: rec.upperLimitWarning,
          medicalNote: rec.medicalNote,
        })),
      },
    },
    include: { recommendationItems: true, approvals: true },
  });

  return NextResponse.json({ ok: true, assessment: saved }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  const existing = await prisma.supplementAssessment.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  await prisma.supplementAssessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
