import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { ingestWorkouts, logSync } from '@/lib/wearables/sync';
import { recalculateToday } from '@/lib/nutrition/dynamic';

/** إدخال تدريبات (يدوي أو من جهاز) مع إزالة التكرار. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`workout:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { provider?: string; workouts?: Array<Record<string, unknown>> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const provider = String(body.provider ?? 'manual');
  const workouts = Array.isArray(body.workouts) ? body.workouts : [];
  if (workouts.length === 0) {
    return NextResponse.json({ error: 'قائمة التدريبات مطلوبة' }, { status: 422 });
  }

  const started = Date.now();
  try {
    const result = await ingestWorkouts(user.id, workouts, provider);
    await recalculateToday(user.id);
    await audit(user.id, 'health.workout.ingest', 'WorkoutSession', undefined, { provider, count: result.workoutsUpserted });
    await logSync(user.id, provider, 'success', result.workoutsUpserted, result.message, Date.now() - started);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logSync(user.id, provider, 'error', 0, err instanceof Error ? err.message : 'فشل الإدخال', Date.now() - started);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذر الحفظ' }, { status: 500 });
  }
}

/** تدريبات اليوم. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const workouts = await prisma.workoutSession.findMany({
    where: { userId: user.id, startTime: { gte: today } },
    orderBy: { startTime: 'desc' },
  });
  return NextResponse.json({ workouts });
}
