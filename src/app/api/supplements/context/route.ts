import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** بيانات سياق حاسبة المكملات: الملف + الاحتياجات + المنتجات + الأدوية + التحاليل + آخر تقييم */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const targets = profile
    ? await prisma.nutritionTargets.findFirst({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  const [products, medications, labResults, latestAssessment] = await Promise.all([
    prisma.supplementProduct.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.medication.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.labResult.findMany({ where: { userId: user.id }, orderBy: { testDate: 'desc' } }),
    prisma.supplementAssessment.findFirst({
      where: { userId: user.id },
      include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    profile,
    targets,
    products,
    medications,
    labResults,
    latestAssessment,
  });
}
