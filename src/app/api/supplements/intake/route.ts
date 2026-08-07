import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const logs = await prisma.supplementIntakeLog.findMany({
    where: { userId: user.id },
    orderBy: { logDate: 'desc' },
    take: 60,
  });
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: {
    productId?: string | null;
    supplementName?: string;
    doseAmount?: number;
    doseUnit?: string;
    timeTaken?: string | null;
    withFood?: boolean;
    compliant?: boolean;
    sideEffects?: string;
    energyLevel?: number | null;
    sleepQuality?: number | null;
    recoveryLevel?: number | null;
    performanceLevel?: number | null;
    stomachIssues?: string;
    weightChangeKg?: number | null;
    athleteNotes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.supplementName?.trim() || typeof body.doseAmount !== 'number' || !body.doseUnit?.trim()) {
    return NextResponse.json({ error: 'اسم المكمل والجرعة مطلوبة' }, { status: 422 });
  }

  const log = await prisma.supplementIntakeLog.create({
    data: {
      userId: user.id,
      productId: body.productId ?? null,
      supplementName: body.supplementName.trim(),
      doseAmount: body.doseAmount,
      doseUnit: body.doseUnit.trim(),
      timeTaken: body.timeTaken ? new Date(body.timeTaken) : null,
      withFood: body.withFood ?? true,
      compliant: body.compliant ?? true,
      sideEffects: body.sideEffects?.trim() || null,
      energyLevel: body.energyLevel ?? null,
      sleepQuality: body.sleepQuality ?? null,
      recoveryLevel: body.recoveryLevel ?? null,
      performanceLevel: body.performanceLevel ?? null,
      stomachIssues: body.stomachIssues?.trim() || null,
      weightChangeKg: body.weightChangeKg ?? null,
      athleteNotes: body.athleteNotes?.trim() || null,
      logDate: new Date(),
    },
  });
  return NextResponse.json({ ok: true, log }, { status: 201 });
}
