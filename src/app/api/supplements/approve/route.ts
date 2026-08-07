import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** اعتماد/رفض تقييم المكملات — للمختص/المدرب/المدير فقط */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['dietitian', 'coach', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مسموح لهذا الدور' }, { status: 403 });
  }

  let body: { assessmentId?: string; action?: string; notes?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.assessmentId || !['approved', 'rejected', 'adjusted'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'التقييم والإجراء مطلوبان' }, { status: 422 });
  }

  const assessment = await prisma.supplementAssessment.findUnique({ where: { id: body.assessmentId } });
  if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  const approval = await prisma.supplementApproval.create({
    data: {
      assessmentId: assessment.id,
      approverId: user.id,
      action: body.action as 'approved' | 'rejected' | 'adjusted',
      notes: body.notes?.trim() || null,
      signature: body.signature?.trim() || null,
    },
  });

  await prisma.supplementAssessment.update({
    where: { id: assessment.id },
    data: { status: body.action },
  });

  return NextResponse.json({ ok: true, approval }, { status: 201 });
}
