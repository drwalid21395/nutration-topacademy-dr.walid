import { prisma } from '@/lib/prisma';
import { startOfToday } from '@/lib/utils';
import { decryptText } from '@/lib/crypto';
import { getAdapter } from '@/lib/wearables/adapters';
import { UnifiedDailyActivity, UnifiedWorkout, ProviderHealthData, SyncResult } from './types';
import { normalizeDailyActivity, extractEnergy, normalizeWorkout, computeTrainingLoad } from './normalize';
import { dedupeWorkouts } from './dedupe';
import { recalculateToday } from '@/lib/nutrition/dynamic';

/**
 * خط مزامنة موحّد: استقبال → تحقق → تطبيع → إزالة تكرار → حفظ → إعادة حساب.
 * يدعم أي تاريخ (وليس اليوم فقط) لالتقاط البيانات المتأخرة من الساعة.
 */

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

/** إدخال نشاط يومي (يدوي أو من جهاز) عبر خط التطبيع الموحّد. */
export async function ingestActivity(
  userId: string,
  raw: Record<string, unknown>,
  provider: string,
  date: Date = startOfToday()
): Promise<SyncResult> {
  const day = startOfDay(date);
  const normalized = normalizeDailyActivity({ ...raw, date: day });
  const energy = extractEnergy(normalized);
  const dateKey = day.toISOString();

  const existingWorkouts = await prisma.workoutSession.findMany({
    where: { userId, startTime: { gte: day, lt: endOfDay(day) } },
    select: { startTime: true, durationMin: true, sportType: true, caloriesBurned: true, distanceM: true, provider: true },
  });

  const existingActivity = await prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: day } } });
  const sources = existingActivity?.sources ? (JSON.parse(existingActivity.sources) as string[]) : [];
  if (!sources.includes(provider)) sources.push(provider);

  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date: day } },
    create: {
      userId,
      date: day,
      steps: normalized.steps ?? 0,
      distanceM: normalized.distanceM,
      activeCalories: energy.activeCalories,
      restingCalories: energy.restingCalories,
      workoutCalories: energy.workoutCalories,
      totalCaloriesBurned: energy.totalCaloriesBurned,
      workoutMinutes: normalized.workoutMinutes ?? 0,
      sleepMinutes: normalized.sleepMinutes,
      avgHeartRate: normalized.avgHeartRate,
      restingHeartRate: normalized.restingHeartRate,
      sources: JSON.stringify([provider]),
      confidence: energy.confidence,
    },
    update: {
      steps: normalized.steps ?? undefined,
      distanceM: normalized.distanceM ?? undefined,
      activeCalories: energy.activeCalories || undefined,
      restingCalories: energy.restingCalories || undefined,
      workoutCalories: energy.workoutCalories || undefined,
      totalCaloriesBurned: energy.totalCaloriesBurned || undefined,
      workoutMinutes: normalized.workoutMinutes ?? undefined,
      sleepMinutes: normalized.sleepMinutes ?? undefined,
      avgHeartRate: normalized.avgHeartRate ?? undefined,
      restingHeartRate: normalized.restingHeartRate ?? undefined,
      sources: JSON.stringify(sources),
      confidence: energy.confidence,
    },
  });

  await recomputeLoad(userId, day);

  const result = await ingestWorkouts(userId, [], provider, existingWorkouts);
  await recalculateToday(userId);
  return result;
}

/** إدخال قائمة تدريبات (يدوي أو من جهاز) مع إزالة التكرار — لأي نافذة تاريخ. */
export async function ingestWorkouts(
  userId: string,
  rawList: Array<Record<string, unknown>>,
  provider: string,
  existing?: Array<{ startTime: Date; durationMin: number | null; sportType: string; caloriesBurned: number | null; distanceM: number | null; provider: string | null }>
): Promise<SyncResult> {
  const normalized: UnifiedWorkout[] = rawList.map((r) => normalizeWorkout({ ...r, provider }));

  // نافذة البحث عن التكرار: من بداية أول تمرين وارد حتى نهاية آخره.
  let existingRecords = existing;
  if (!existingRecords) {
    const times = normalized.map((w) => w.startTime.getTime());
    const minDate = times.length ? startOfDay(new Date(Math.min(...times))) : startOfToday();
    existingRecords = await prisma.workoutSession.findMany({
      where: { userId, startTime: { gte: minDate } },
      select: { startTime: true, durationMin: true, sportType: true, caloriesBurned: true, distanceM: true, provider: true },
    });
  }

  const { workouts, duplicated } = dedupeWorkouts(normalized, existingRecords);

  let created = 0;
  for (const w of workouts) {
    if (w.sportType === 'swim' || w.sportType === 'gym') {
      try {
        await prisma.trainingLogEntry.create({
          data: {
            userId,
            sessionType: w.sportType,
            durationMin: w.durationMin ?? undefined,
            distanceM: w.distanceM != null ? Math.round(w.distanceM) : undefined,
            intensity: w.intensity,
            caloriesBurned: w.caloriesBurned,
            note: w.externalId ? `مزامنة من ${provider}` : undefined,
          },
        });
      } catch {
        // تجاهل تعارضات السجلات المحلية.
      }
    }
    await prisma.workoutSession.create({
      data: {
        userId,
        sportType: w.sportType,
        startTime: w.startTime,
        durationMin: w.durationMin,
        caloriesBurned: w.caloriesBurned,
        distanceM: w.distanceM,
        intensity: w.intensity,
        source: provider === 'manual' ? 'manual' : 'device',
        provider,
        externalId: w.externalId,
        laps: w.laps,
        poolLengthM: w.poolLengthM,
        strokeType: w.strokeType,
        avgPacePer100m: w.avgPacePer100m,
        swolf: w.swolf,
        avgHeartRate: w.avgHeartRate,
        confidence: w.confidence,
      },
    });
    created += 1;
  }

  const affectedDates = new Set<string>([startOfToday().toISOString()]);
  for (const w of workouts) affectedDates.add(startOfDay(w.startTime).toISOString());
  for (const key of affectedDates) await recomputeLoad(userId, new Date(key));

  return { activityUpserted: 0, workoutsUpserted: created, duplicated, message: `تمت مزامنة ${created} تمرين${created !== 1 ? 'ات' : ''}.` };
}

/** إدخال حزمة بيانات كاملة من مزود (نشاط + تدريبات + نوم + وزن) — يُستخدم من المزامنة الآلية. */
export async function ingestProviderData(
  userId: string,
  data: ProviderHealthData,
  provider: string
): Promise<SyncResult> {
  let activityUpserted = 0;
  let workoutsUpserted = 0;
  let duplicated = 0;

  for (const day of data.activity ?? []) {
    if (!day?.date) continue;
    const result = await ingestActivity(userId, day as Record<string, unknown>, provider, day.date);
    activityUpserted += 1;
    workoutsUpserted += result.workoutsUpserted;
    duplicated += result.duplicated;
  }

  if ((data.workouts?.length ?? 0) > 0) {
    const result = await ingestWorkouts(userId, data.workouts ?? [], provider);
    workoutsUpserted += result.workoutsUpserted;
    duplicated += result.duplicated;
  }

  // الوزن — سجل يومي يسمح بتعديل الهدف لاحقًا.
  for (const w of data.weight ?? []) {
    const day = startOfDay(w.date);
    const existing = await prisma.weightLogEntry.findFirst({ where: { userId, date: day } });
    if (existing) {
      await prisma.weightLogEntry.update({ where: { id: existing.id }, data: { weightKg: w.weightKg } });
    } else {
      await prisma.weightLogEntry.create({ data: { userId, date: day, weightKg: w.weightKg } });
    }
  }

  await recalculateToday(userId);
  const message = `تم استيراد نشاط ${activityUpserted} يوم و ${workoutsUpserted} تمرين.`;
  return { activityUpserted, workoutsUpserted, duplicated, message };
}

/** إعادة حساب تحميل التدريب ليوم محدد من التدريبات والنشاط المحفوظ. */
async function recomputeLoad(userId: string, date: Date) {
  const day = startOfDay(date);
  const [activity, workouts] = await Promise.all([
    prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: day } } }),
    prisma.workoutSession.findMany({ where: { userId, startTime: { gte: day, lt: endOfDay(day) } } }),
  ]);
  if (!activity) return;
  const unifiedActivity: UnifiedDailyActivity = {
    date: day,
    steps: activity.steps,
    distanceM: activity.distanceM ?? undefined,
  };
  const unifiedWorkouts: UnifiedWorkout[] = workouts.map((w) => ({
    startTime: w.startTime,
    sportType: w.sportType,
    durationMin: w.durationMin ?? undefined,
    distanceM: w.distanceM ?? undefined,
    caloriesBurned: w.caloriesBurned ?? undefined,
  }));
  const { label, score } = computeTrainingLoad(unifiedActivity, unifiedWorkouts);
  const minutes = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  await prisma.dailyActivity.update({
    where: { id: activity.id },
    data: {
      trainingLoad: label,
      loadScore: score,
      workoutMinutes: minutes,
      workoutCalories: workouts.reduce((a, w) => a + (w.caloriesBurned ?? 0), 0) || undefined,
    },
  });
}

/** حفظ سجل المزامنة. */
export async function logSync(userId: string, provider: string, status: string, items: number, message?: string, durationMs?: number) {
  try {
    await prisma.syncLog.create({ data: { userId, provider, status, items, message, durationMs } });
  } catch {
    // لا نكسر سير العمل عند فشل السجل.
  }
}

/** الاتصالات المستحقة للمزامنة (جهاز فعلي) — للمستخدم أو للجميع. */
export async function findDueConnections(userId?: string, maxAgeMs = 15 * 60 * 1000) {
  const conns = await prisma.wearableConnection.findMany({
    where: userId
      ? { userId, status: 'connected', provider: { not: 'manual' } }
      : { status: 'connected', provider: { not: 'manual' } },
    orderBy: { updatedAt: 'desc' },
  });
  const now = Date.now();
  return conns.filter((c) => !c.lastSyncAt || now - c.lastSyncAt.getTime() > maxAgeMs);
}

/** تشغيل مزامنة كاملة لاتصال واحد وحفظ النتيجة. */
export async function runSyncConnection(conn: { id: string; userId: string; provider: string; accessToken: string | null }): Promise<{ provider: string; ok: boolean; message: string }> {
  const started = Date.now();
  try {
    const token = decryptText(conn.accessToken);
    if (!token) throw new Error('لا يوجد توكن صالح — أعد الربط.');
    const adapter = getAdapter(conn.provider);
    const data = await adapter.sync(conn.userId, token);
    const ingested = await ingestProviderData(conn.userId, data, conn.provider);
    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
    await logSync(conn.userId, conn.provider, 'success', ingested.workoutsUpserted, ingested.message, Date.now() - started);
    return { provider: conn.provider, ok: true, message: ingested.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل المزامنة';
    try {
      await prisma.wearableConnection.update({ where: { id: conn.id }, data: { lastSyncError: message } });
    } catch {
      // تجاهل
    }
    await logSync(conn.userId, conn.provider, 'error', 0, message, Date.now() - started);
    return { provider: conn.provider, ok: false, message };
  }
}
