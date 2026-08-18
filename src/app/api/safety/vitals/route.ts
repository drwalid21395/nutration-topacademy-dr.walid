// POST /api/safety/vitals — استقبال عيّنات القياس الحيوية من الساعة/الهاتف
// GET  /api/safety/vitals — جلب آخر عيّنات

import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-user';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { assessRisk, triggerAlert, checkFalseAlarmProtection, isInCooldown } from '@/lib/safety';
import { prisma as db } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  let user = await getApiUser(req);
  if (!user) user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (rateLimit(`${ip}:safety-vitals`, 120, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });

  // حفظ عيّنة القياس
  const sample = await db.vitalSample.create({
    data: {
      userId: user.id,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      heartRate: body.heartRate ?? null,
      heartRateVariability: body.heartRateVariability ?? null,
      spo2: body.spo2 ?? null,
      respiratoryRate: body.respiratoryRate ?? null,
      bodyTemperature: body.bodyTemperature ?? null,
      stressLevel: body.stressLevel ?? null,
      accelerometerX: body.accelerometerX ?? null,
      accelerometerY: body.accelerometerY ?? null,
      accelerometerZ: body.accelerometerZ ?? null,
      gyroscopeX: body.gyroscopeX ?? null,
      gyroscopeY: body.gyroscopeY ?? null,
      gyroscopeZ: body.gyroscopeZ ?? null,
      movementMagnitude: body.movementMagnitude ?? null,
      gpsLat: body.gpsLat ?? null,
      gpsLng: body.gpsLng ?? null,
      batteryLevel: body.batteryLevel ?? null,
      workoutStatus: body.workoutStatus ?? null,
      signalQuality: body.signalQuality ?? null,
      source: body.source ?? 'mobile',
    },
  });

  // تقييم الخطورة
  const risk = await assessRisk(user.id, {
    timestamp: sample.timestamp,
    heartRate: sample.heartRate,
    heartRateVariability: sample.heartRateVariability,
    spo2: sample.spo2,
    respiratoryRate: sample.respiratoryRate,
    bodyTemperature: sample.bodyTemperature,
    stressLevel: sample.stressLevel,
    movementMagnitude: sample.movementMagnitude,
    workoutStatus: sample.workoutStatus,
    signalQuality: sample.signalQuality,
    batteryLevel: sample.batteryLevel,
    gpsLat: sample.gpsLat,
    gpsLng: sample.gpsLng,
  });

  let alertId: string | null = null;

  if (risk.overallRisk !== 'normal' && risk.overallRisk !== 'attention') {
    // حماية الإنذارات الكاذبة
    const falseAlarmCheck = await checkFalseAlarmProtection(user.id, risk.overallRisk, risk.riskScore);

    if (falseAlarmCheck.shouldProceed) {
      // فحص فترة الهدوء
      const safetySettings = await db.safetySettings.findUnique({ where: { userId: user.id } });
      const cooldown = safetySettings?.cooldownMinutes ?? 5;
      const inCooldown = await isInCooldown(user.id, cooldown);

      if (!inCooldown) {
        alertId = await triggerAlert(user.id, {
          timestamp: sample.timestamp,
          heartRate: sample.heartRate,
          spo2: sample.spo2,
          respiratoryRate: sample.respiratoryRate,
          workoutStatus: sample.workoutStatus,
          movementMagnitude: sample.movementMagnitude,
        }, {
          ...risk,
          overallRisk: falseAlarmCheck.adjustedSeverity,
        });

        // تسجيل الحدث
        await db.safetyEvent.create({
          data: {
            userId: user.id,
            eventType: risk.activeIndicators[0] ?? 'general',
            severity: falseAlarmCheck.adjustedSeverity,
            heartRate: sample.heartRate,
            spo2: sample.spo2,
            riskScore: risk.riskScore,
            description: risk.vitals.find((v) => v.severity === 'critical' || v.severity === 'warning')?.message,
            rawData: JSON.stringify(risk),
          },
        });
      }
    }
  }

  await audit(user.id, 'safety.vitals', 'VitalSample', sample.id, { riskScore: risk.riskScore });

  return NextResponse.json({
    ok: true,
    sampleId: sample.id,
    risk: {
      level: risk.overallRisk,
      score: risk.riskScore,
      indicators: risk.activeIndicators,
      isMultiIndicator: risk.isMultiIndicator,
      isMovementAnomaly: risk.isMovementAnomaly,
      swimSessionActive: risk.swimSessionActive,
    },
    alertId,
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);

  const samples = await db.vitalSample.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return NextResponse.json({ samples });
}
