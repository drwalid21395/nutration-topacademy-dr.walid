import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/security';

const PREF_KEYS = [
  'breakfastTime', 'lunchTime', 'dinnerTime', 'snackTimes', 'preWorkoutTime', 'postWorkoutTime',
  'waterInterval', 'trainingTime', 'sleepTime', 'weighInTime', 'competitionReminderDays',
  'planReviewReminderDays', 'soundEnabled', 'quietHoursStart', 'quietHoursEnd', 'pushEnabled',
  'inAppEnabled', 'smartAlerts', 'waterLowAlertThreshold', 'days',
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const prefs = await prisma.notificationPref.findUnique({ where: { userId: user.id } });
  if (!prefs) {
    return NextResponse.json({ prefs: null });
  }
  return NextResponse.json({
    prefs: {
      ...prefs,
      days: prefs.days ? safeParse(prefs.days) : undefined,
      snackTimes: prefs.snackTimes ? safeParse(prefs.snackTimes) : undefined,
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`prefs:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of PREF_KEYS) {
    if (body[key] === undefined) continue;
    if (key === 'days' || key === 'snackTimes') {
      data[key] = Array.isArray(body[key]) ? JSON.stringify(body[key]) : String(body[key] ?? '');
    } else if (typeof body[key] === 'boolean' || typeof body[key] === 'number') {
      data[key] = body[key];
    } else {
      data[key] = body[key] === null || body[key] === '' ? null : String(body[key]);
    }
  }

  const prefs = await prisma.notificationPref.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return NextResponse.json({ ok: true, prefs });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
