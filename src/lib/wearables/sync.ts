/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/sync.ts

وظيفة الملف:
"خط المزامنة الموحّد" — الطريق الذي تمر منه كل بيانات الساعات
قبل أن تدخل قاعدة البيانات، بالترتيب:
استقبال ← تحقق ← تطبيع ← إزالة تكرار ← حفظ ← إعادة حساب.
يدعم أي تاريخ (وليس اليوم فقط) لالتقاط البيانات المتأخرة.

لماذا نحتاجه؟
كل مزود يرسل بياناته بصيغة مختلفة. بدلًا من تكرار منطق
"التطبيع ثم الحفظ" في كل ملف، لدينا مسار واحد هنا يضمن
الترتيب نفسه والنتيجة نفسها مهما كان مصدر البيانات.

متى يعمل؟
- عند كل مزامنة من ساعة (يدوية أو آلية).
- عند الإدخال اليدوي للنشاط والتدريبات.
- عند تشغيل المزامنة الدورية (cron).

من يستدعيه؟
- واجهات API الخاصة بالربط والإدخال اليدوي.
- سكريبت المزامنة الدورية عبر findDueConnections + runSyncConnection.

الملفات التي يتعامل معها:
- ./types: الصيغ الموحّدة.
- ./normalize: التطبيع واستخراج الطاقة وحساب الحمولة.
- ./dedupe: إزالة التكرار.
- ./adapters: اختيار المحوّل الصحيح.
- src/lib/prisma.ts و src/lib/utils.ts و src/lib/crypto.ts.
- src/lib/nutrition/dynamic.ts: إعادة حساب الهدف اليومي.

ترتيب العمل:
بيانات خام ← normalizeDailyActivity/normalizeWorkout ←
extractEnergy ← dedupeWorkouts ← حفظ في القاعدة ←
recomputeLoad ← recalculateToday
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// prisma: من ملف محلي (src/lib/prisma.ts) — الاتصال بقاعدة البيانات.
import { prisma } from '@/lib/prisma';

// من ملف محلي src/lib/utils.ts: تاريخ اليوم في منتصف الليل.
import { startOfToday } from '@/lib/utils';

// من ملف محلي src/lib/crypto.ts: فك تشفير توكن الوصول قبل الاستخدام.
import { decryptText } from '@/lib/crypto';

// من ملف محلي ./adapters: اختيار المحوّل (المترجم) الصحيح للمزود.
import { getAdapter } from '@/lib/wearables/adapters';

// من ملف محلي ./types: الصيغ الموحّدة + نتيجة المزامنة.
import { UnifiedDailyActivity, UnifiedWorkout, ProviderHealthData, SyncResult } from './types';

// من ملف محلي ./normalize: التطبيع + استخراج الطاقة + حساب الحمولة.
import { normalizeDailyActivity, extractEnergy, normalizeWorkout, computeTrainingLoad } from './normalize';

// من ملف محلي ./dedupe: إزالة التدريبات المكررة.
import { dedupeWorkouts } from './dedupe';

// من ملف محلي src/lib/nutrition/dynamic.ts: إعادة حساب الهدف
// الغذائي اليومي بعد تغيّر النشاط.
import { recalculateToday } from '@/lib/nutrition/dynamic';

/**
 * خط مزامنة موحّد: استقبال → تحقق → تطبيع → إزالة تكرار → حفظ → إعادة حساب.
 * يدعم أي تاريخ (وليس اليوم فقط) لالتقاط البيانات المتأخرة من الساعة.
 */

// ========================================
// 2. دوال مساعدة للحدود الزمنية
// ========================================

// startOfDay: يعيد بداية اليوم (منتصف الليل) لأي تاريخ.
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
// endOfDay: يعيد بداية اليوم التالي — نستخدمه كحد "أقل من"
// لالتقاط كل سجلات اليوم في الاستعلامات.
function endOfDay(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

// ========================================
// 3. إدخال النشاط اليومي
// ========================================

/*
-----------------------------------------
الدالة: ingestActivity (مصدَّرة)
-----------------------------------------
وظيفتها: إدخال/تحديث نشاط يوم واحد (يدوي أو من جهاز) عبر
         خط التطبيع الموحّد، ثم إعادة حساب حمولة اليوم والهدف.
Input: userId + raw (بيانات النشاط الخام) + provider (المصدر)
       + date (تاريخ النشاط، الافتراضي اليوم).
Processing: نطبّع البيانات ونستخرج الطاقة، ثم نحدّث أو نُنشئ
            سجل dailyActivity (upsert) مع دمج قائمة المصادر،
            ثم نعيد حساب الحمولة وندعو إعادة حساب الهدف الغذائي.
Output: SyncResult.
يستدعيها: واجهات الإدخال اليدوي + ingestProviderData (في نفس الملف).
ماذا تستدعي: normalizeDailyActivity + extractEnergy + recomputeLoad
            + ingestWorkouts + recalculateToday + prisma.
-----------------------------------------
*/
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
      avgSpo2: normalized.avgSpo2,
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
      avgSpo2: normalized.avgSpo2 ?? undefined,
      sources: JSON.stringify(sources),
      confidence: energy.confidence,
    },
  });

  await recomputeLoad(userId, day);

  const result = await ingestWorkouts(userId, [], provider, existingWorkouts);
  await recalculateToday(userId);
  await touchMobileConnection(userId, provider);
  return result;
}

/** إنشاء/تحديث اتصال «تطبيق الموبايل» (مزود mobile) لظهوره كمرتبط في صفحة ربط الساعة. */
export async function touchMobileConnection(userId: string, provider: string) {
  if (provider !== 'mobile') return;
  const existing = await prisma.wearableConnection.findFirst({
    where: { userId, provider: 'mobile' },
  });
  const data = {
    status: 'connected' as const,
    deviceName: 'تطبيق توب أكاديمي (Health Connect)',
    lastSyncAt: new Date(),
    lastSyncError: null,
  };
  if (existing) {
    await prisma.wearableConnection.update({ where: { id: existing.id }, data });
  } else {
    await prisma.wearableConnection.create({
      data: {
        userId,
        provider: 'mobile',
        providerName: 'تطبيق الموبايل (Health Connect)',
        status: 'connected',
        deviceName: 'تطبيق توب أكاديمي (Health Connect)',
        source: 'device',
        consentAt: new Date(),
        scopes: JSON.stringify(['activity', 'workouts']),
        lastSyncAt: new Date(),
      },
    });
  }
}

// ========================================
// 4. إدخال التدريبات مع إزالة التكرار
// ========================================

/*
-----------------------------------------
الدالة: ingestWorkouts (مصدَّرة)
-----------------------------------------
وظيفتها: إدخال قائمة تدريبات (يدوي أو من جهاز) مع إزالة
         التكرار — لأي نافذة تاريخ.
Input: userId + rawList (التدريبات الخام) + provider + existing
       (اختياري — تدريبات معروفة مسبقًا لتجنب استعلام إضافي).
Processing: نطبّع كل تمرين، نحدد نافذة البحث عن التكرار، ثم
            نمرر على dedupeWorkouts. التدريبات الجديدة تُحفظ
            في workoutSession (وبعضها أيضًا في trainingLogEntry
            للسباحة والجيم — مع تجاهل أي تعارض)، ثم نعيد حساب
            الحمولة للأيام المتأثرة.
Output: SyncResult (عدد ما أُدرج + عدد التكرارات المستبعدة).
يستدعيها: ingestActivity و ingestProviderData (في نفس الملف) +
          واجهات الإدخال اليدوي.
ماذا تستدعي: normalizeWorkout + dedupeWorkouts + recomputeLoad + prisma.
-----------------------------------------
*/
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

  await touchMobileConnection(userId, provider);

  return { activityUpserted: 0, workoutsUpserted: created, duplicated, message: `تمت مزامنة ${created} تمرين${created !== 1 ? 'ات' : ''}.` };
}

// ========================================
// 5. إدخال حزمة بيانات كاملة من مزود
// ========================================

/*
-----------------------------------------
الدالة: ingestProviderData (مصدَّرة)
-----------------------------------------
وظيفتها: إدخال حزمة بيانات كاملة قادمة من مزود (نشاط لكل يوم
         + تدريبات + وزن) — تُستخدم من المزامنة الآلية.
Input: userId + data (ProviderHealthData) + provider.
Processing: نمر على أيام النشاط (لكل يوم ingestActivity)، ثم
            التدريبات (ingestWorkouts)، ثم الوزن (تحديث أو إنشاء
            سجل وزن يومي)، ثم نعيد حساب الهدف الغذائي.
Output: SyncResult موحّد مع رسالة ملخص.
يستدعيها: sync.ts نفسها (في runSyncConnection).
ماذا تستدعي: ingestActivity + ingestWorkouts + recalculateToday + prisma.
-----------------------------------------
*/
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

// ========================================
// 6. إعادة حساب الحمولة وسجل المزامنة
// ========================================

/*
-----------------------------------------
الدالة: recomputeLoad (داخلية — غير مصدَّرة)
-----------------------------------------
وظيفتها: إعادة حساب تحميل التدريب ليوم محدد من التدريبات
         والنشاط المحفوظ، وتحديث الحقول في dailyActivity.
Input: userId + date.
Processing: نجلب النشاط والتدريبات لذلك اليوم، نبني صيغة موحّدة،
            نحسب computeTrainingLoad، ثم نحدّث الحمولة ودقائق
            التدريب وسعرات التدريب.
Output: void (تحديث في القاعدة فقط).
يستدعيها: ingestActivity و ingestWorkouts (في نفس الملف).
ماذا تستدعي: computeTrainingLoad + prisma.
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: logSync (مصدَّرة)
-----------------------------------------
وظيفتها: حفظ سجل المزامنة (نجاح/فشل) في قاعدة البيانات.
Input: userId + provider + status + items + message اختياري + durationMs اختياري.
Processing: نحفظ سجلًا جديدًا في syncLog؛ أي فشل يُتجاهل حتى
            لا يكسر سير العمل.
Output: void.
يستدعيها: runSyncConnection (في نفس الملف).
-----------------------------------------
*/
/** حفظ سجل المزامنة. */
export async function logSync(userId: string, provider: string, status: string, items: number, message?: string, durationMs?: number) {
  try {
    await prisma.syncLog.create({ data: { userId, provider, status, items, message, durationMs } });
  } catch {
    // لا نكسر سير العمل عند فشل السجل.
  }
}

// ========================================
// 7. المزامنة الآلية للاتصالات
// ========================================

/*
-----------------------------------------
الدالة: findDueConnections (مصدَّرة)
-----------------------------------------
وظيفتها: إيجاد الاتصالات "المستحقة" للمزامنة (جهاز فعلي،
         غير يدوي) — للمستخدم الواحد أو للجميع.
Input: userId اختياري (بدونه نعالج الكل) + maxAgeMs (أقدم مدة
       مسموحة منذ آخر مزامنة، الافتراضي 15 دقيقة).
Processing: نجلب الاتصالات المتصلة ثم نفلتر من لم يُزامن بعد
            أو مزامنته أقدم من المسموح.
Output: قائمة الاتصالات المستحقة.
يستدعيها: سكريبت المزامنة الدورية (cron).
ماذا تستدعي: prisma.
-----------------------------------------
*/
/** الاتصالات المستحقة للمزامنة (جهاز فعلي) — للمستخدم أو للجميع. */
export async function findDueConnections(userId?: string, maxAgeMs = 15 * 60 * 1000) {
  const conns = await prisma.wearableConnection.findMany({
    where: userId
      ? { userId, status: 'connected', provider: { notIn: ['manual', 'mobile'] } }
      : { status: 'connected', provider: { notIn: ['manual', 'mobile'] } },
    orderBy: { updatedAt: 'desc' },
  });
  const now = Date.now();
  return conns.filter((c) => !c.lastSyncAt || now - c.lastSyncAt.getTime() > maxAgeMs);
}

/*
-----------------------------------------
الدالة: runSyncConnection (مصدَّرة)
-----------------------------------------
وظيفتها: تشغيل مزامنة كاملة لاتصال واحد وحفظ النتيجة.
Input: conn (اتصال من القاعدة: id, userId, provider, accessToken).
Processing: نفك تشفير التوكن (قد يرمي خطأ "أعد الربط")، نختار
            المحوّل ونستدعي sync ثم ingestProviderData، ثم نحدّث
            وقت آخر مزامنة، ونسجّل النجاح. عند أي خطأ نحدّث
            lastSyncError ونسجّل الفشل.
Output: { provider, ok, message }.
يستدعيها: سكريبت المزامنة الدورية وواجهات المزامنة اليدوية.
ماذا تستدعي: decryptText + getAdapter + ingestProviderData + logSync + prisma.
-----------------------------------------
*/
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
