// GET /api/safety/settings — جلب إعدادات السلامة
// PUT /api/safety/settings — تحديث إعدادات السلامة

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_THRESHOLDS } from '@/lib/safety';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const settings = await prisma.safetySettings.findUnique({ where: { userId: user.id } });
  if (!settings) return NextResponse.json({ settings: DEFAULT_THRESHOLDS });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });

  const update: Record<string, unknown> = {};
  const allowed = [
    'heartRateCriticalHigh', 'heartRateCriticalLow', 'heartRateWarningHigh', 'heartRateWarningLow',
    'spo2CriticalLow', 'spo2WarningLow',
    'respiratoryRateCriticalHigh', 'respiratoryRateCriticalLow', 'respiratoryRateWarningHigh', 'respiratoryRateWarningLow',
    'hrvCriticalLow', 'hrvWarningLow',
    'temperatureCriticalHigh', 'temperatureWarningHigh', 'temperatureCriticalLow', 'temperatureWarningLow',
    'stressCriticalHigh', 'stressWarningHigh',
    'noMovementDurationSec', 'noMovementSwimDurationSec',
    'cooldownMinutes', 'enabled', 'soundEnabled', 'hapticEnabled', 'autoCallEmergency',
  ];

  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const existing = await prisma.safetySettings.findUnique({ where: { userId: user.id } });
  if (existing) {
    await prisma.safetySettings.update({ where: { userId: user.id }, data: update });
  } else {
    await prisma.safetySettings.create({ data: { userId: user.id, enabled: true, autoCallEmergency: true, ...update } });
  }

  return NextResponse.json({ ok: true });
}
