import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSupplementPdfReport } from '@/services/pdf/supplement-pdf';
import type { SupplementAssessmentOutput } from '@/services/supplements/types';
import { saveReportToDrive } from '@/lib/google-sync';

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { id } = await ctx.params;

  const assessment = await prisma.supplementAssessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });

  const output: SupplementAssessmentOutput = {
    version: assessment.version,
    overallLevel: (assessment.overallLevel ?? 'none') as SupplementAssessmentOutput['overallLevel'],
    needsMedicalApproval: assessment.needsMedicalApproval,
    needsGuardianConsent: assessment.needsGuardianConsent,
    needsLabTest: assessment.needsLabTest,
    coverage: parse(assessment.coverage, []),
    eligibility: parse(assessment.eligibility, []),
    proteinGap: parse(assessment.proteinGap, null),
    hydration: parse(assessment.hydration, null),
    recommendations: parse(assessment.recommendations, []),
    schedule: parse(assessment.schedule, []),
    foodAlternatives: parse(assessment.foodAlternatives, []),
    summary: '',
  };

  const buffer = await generateSupplementPdfReport({
    athleteName: dbUser?.name ?? profile?.fullName ?? 'سباح',
    gender: profile?.gender ?? 'male',
    age: profile?.age ?? null,
    weightKg: profile?.weightKg ?? null,
    issueDate: new Date(assessment.createdAt).toLocaleDateString('ar-EG'),
    version: assessment.version,
    assessment: output,
  });

  saveReportToDrive({
    swimmerName: dbUser?.name ?? profile?.fullName ?? 'سباح',
    kind: 'supplement',
    fileName: `supplement-assessment-${assessment.id}.pdf`,
    mimeType: 'application/pdf',
    base64: buffer.toString('base64'),
  }).catch(() => {});

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="supplement-assessment-${assessment.id}.pdf"`,
    },
  });
}
