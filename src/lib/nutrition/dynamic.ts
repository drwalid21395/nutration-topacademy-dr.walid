/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/nutrition/dynamic.ts

وظيفة الملف:
"محرك التغذية الديناميكية": يحسب هدف السعرات اليومي للسباح
بشكل ذكي — يبدأ من الهدف الأساسي (الخطة الغذائية أو آخر حسابات)
ثم يضيف "سعرات النشاط المؤهلة" لليوم (من الساعة أو التدريب)
مضروبة في معامل معاوضة حسب الهدف.

لماذا نحتاجه؟
احتياج السباح يختلف من يوم لآخر حسب تدريبه. بدل هدف ثابت،
نعيد الحساب يوميًا: يوم تدريب شاق يرفع السعرات، ويوم راحة
يُبقيها على المستوى الأساسي.

متى يعمل؟
- عند نهاية أي مزامنة من الساعة (يستدعيه sync.ts).
- عند طلب "حالة اليوم" للوحة التحكم.

من يستدعيه؟
- src/lib/wearables/sync.ts (بعد استيراد بيانات النشاط).
- الصفحات/واجهات API التي تعرض حالة اليوم (لوحة السباح).

الملفات التي يتعامل معها:
- src/lib/prisma.ts: قراءة وكتابة قاعدة البيانات.
- src/lib/utils.ts: دالة بداية اليوم (startOfToday).
- src/lib/wearables/normalize.ts: حساب حمولة التدريب (computeTrainingLoad).

ترتيب العمل:
قراءة الهدف الأساسي ← قراءة نشاط اليوم وتدريباته ← حساب
السعرات المؤهلة ← حساب الماكروز والماء ← حفظ النتيجة في الجدول
(upsert) ← إرجاع النتيجة
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// prisma: من ملف محلي (src/lib/prisma.ts) — الاتصال بقاعدة البيانات.
import { prisma } from '@/lib/prisma';
// startOfToday: من ملف محلي (src/lib/utils.ts) — إرجاع تاريخ اليوم
// مع تصفير الساعة والدقائق (بداية اليوم تمامًا) للمقارنات.
import { startOfToday } from '@/lib/utils';

// computeTrainingLoad: من ملف محلي (src/lib/wearables/normalize.ts) —
// يحسب "درجة حمولة التدريب" (راحة/خفيف/متوسط/شاق/مرتفع جدًا)
// من النشاط والتدريبات المسجلة.
import { computeTrainingLoad } from '@/lib/wearables/normalize';

/**
 * محرك التغذية الديناميكية (Dynamic Nutrition Engine).
 *
 * المعادلة الأساسية:
 *   Adjusted Target = Base Target + Eligible Activity Calories
 *
 * السعرات المؤهلة فقط (وليس كل ما تعرضه الساعة) تُضاف، مع معاوضة قابلة
 * للضبط حسب الهدف (يمكن للمختص تغييرها لاحقًا عبر الإعدادات).
 */

// ========================================
// 2. أنواع الأهداف ومعامل المعاوضة
// ========================================

// GoalKey: قائمة أهداف السباح الغذائية المحتملة (Union type).
// كل هدف له "معامل معاوضة" مختلف — كم نسبة من سعرات النشاط
// نضيف فعليًا إلى الهدف اليومي.
export type GoalKey =
  | 'maintenance'
  | 'fatLoss'
  | 'muscleGain'
  | 'endurance'
  | 'recovery'
  | 'competition'
  | 'weightGain';

/** معامل المعاوضة لكل هدف — قابلة للتعديل من قبل المختص (لاحقًا عبر SiteSetting). */
export const DEFAULT_COMPENSATION: Record<GoalKey, number> = {
  maintenance: 0.8,
  fatLoss: 0.4,
  muscleGain: 0.8,
  endurance: 0.9,
  recovery: 0.6,
  competition: 0.9,
  weightGain: 1.0,
};

/*
-----------------------------------------
الدالة: compensationFor
-----------------------------------------
وظيفتها: إرجاع معامل المعاوضة المناسب لهدف معين.
Input: goal (نص الهدف، قد يكون null أو غير محدد).
Processing: إن لم يوجد هدف نعتبره 'maintenance'، ثم نقرأ معامله؛
            وإن لم يوجد للهدف معامل نعيد 0.5 كقيمة افتراضية آمنة.
Output: رقم المعامل (0.4 مثلاً يعني نضيف 40% من سعرات النشاط).
يستدعيها: recalculateToday (داخل هذا الملف).
-----------------------------------------
*/
export function compensationFor(goal?: string | null): number {
  const g = (goal ?? 'maintenance') as GoalKey;
  return DEFAULT_COMPENSATION[g] ?? 0.5;
}

// ========================================
// 3. جلب الهدف الأساسي ونشاط اليوم (دوال داخلية)
// ========================================

/*
-----------------------------------------
الدالة: getBaseTarget (داخلية — غير مصدَّرة)
-----------------------------------------
وظيفتها: جلب "الهدف الأساسي" (سعرات + ماكروز + ماء) للمستخدم.
Input: userId (معرّف المستخدم).
Processing: نبحث أولاً عن الخطة الغذائية النشطة (isActive: true)؛
            إن وُجدت نأخذ أرقامها، وإلا نأخذ آخر سجلات أهداف التغذية،
            وإن لم يوجد شيء نعيد قيمًا افتراضية (2200 سعرة).
Output: كائن يحتوي السعرات والبروتين والكربوهيدرات والدهون والماء.
يستدعيها: recalculateToday (داخل هذا الملف).
ماذا تستدعي: prisma.mealPlan و prisma.nutritionTargets.
-----------------------------------------
*/
/** مصدر الهدف الأساسي: الخطة النشطة أولًا ثم آخر حسابات السعرات. */
async function getBaseTarget(userId: string): Promise<{
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  waterMl: number | null;
  goal?: string | null;
}> {
  const [plan, latest] = await Promise.all([
    prisma.mealPlan.findFirst({ where: { userId, isActive: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.nutritionTargets.findFirst({
      where: { profile: { userId } },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  if (plan?.totalCalories) {
    return {
      calories: plan.totalCalories,
      proteinG: plan.proteinG,
      carbsG: plan.carbsG,
      fatG: plan.fatG,
      waterMl: plan.waterMl,
      goal: plan.goal,
    };
  }
  return {
    calories: latest?.calories ?? 2200,
    proteinG: latest?.proteinG ?? null,
    carbsG: latest?.carbsG ?? null,
    fatG: latest?.fatG ?? null,
    waterMl: latest?.waterMl ?? null,
    goal: latest?.profile?.goal,
  };
}

/*
-----------------------------------------
الدالة: getTodayActivity (داخلية — غير مصدَّرة)
-----------------------------------------
وظيفتها: تجميع كل نشاط اليوم من قاعدة البيانات في "صيغة موحّدة".
Input: userId.
Processing: نقرأ نشاط اليوم (dailyActivity) + تدريبات اليوم
            (workoutSession) + ملف السباح (swimmerProfile)
            بالتوازي، ثم نبني كائنات موحّدة ونحسب حمولة التدريب.
Output: { activity, workouts, profile, load }.
يستدعيها: recalculateToday.
ماذا تستدعي: startOfToday و computeTrainingLoad و prisma.
-----------------------------------------
*/
/** تجميع نشاط اليوم من سجلاتنا الموحّدة. */
async function getTodayActivity(userId: string) {
  const today = startOfToday();
  const [activity, workouts, profile] = await Promise.all([
    prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.workoutSession.findMany({ where: { userId, startTime: { gte: today } } }),
    prisma.swimmerProfile.findFirst({ where: { userId } }),
  ]);
  const unifiedActivity = {
    date: today,
    steps: activity?.steps ?? 0,
    distanceM: activity?.distanceM ?? undefined,
  };
  const unifiedWorkouts = workouts.map((w) => ({
    startTime: w.startTime,
    sportType: w.sportType,
    durationMin: w.durationMin ?? undefined,
    distanceM: w.distanceM ?? undefined,
    caloriesBurned: w.caloriesBurned ?? undefined,
  }));
  const load = computeTrainingLoad(unifiedActivity, unifiedWorkouts);
  return { activity, workouts, profile, load };
}

// ========================================
// 4. الحساب الديناميكي الرئيسي
// ========================================

/**
 * حساب الهدف اليومي الديناميكي وحفظه.
 * السعرات المؤهلة = أكبر من (سعرات النشاط، سعرات التدريب) × معامل المعاوضة
 * — لا نضيف total (لأنه يتضمن BMR) ولا نجمع القيم المتداخلة.
 */
export async function recalculateToday(userId: string) {
  const today = startOfToday();
  const base = await getBaseTarget(userId);
  const { activity, workouts, profile, load } = await getTodayActivity(userId);

  const activeCalories = activity?.activeCalories ?? 0;
  const workoutCalories = activity?.workoutCalories ?? workouts.reduce((a, w) => a + (w.caloriesBurned ?? 0), 0);
  const activityEnergy = Math.max(activeCalories, workoutCalories);
  const factor = compensationFor(profile?.goal ?? base.goal);
  const eligible = Math.round(activityEnergy * factor);

  const adjusted = Math.round(base.calories + eligible);

  // الماكروز: البروتين يبقى مستقرًا، الكربوهيدرات ترتفع مع حمولة التدريب،
  // الدهون تكمل الفرق — لا تغيير عشوائي.
  const extraCals = Math.max(0, adjusted - base.calories);
  const proteinG = base.proteinG ?? Math.round((adjusted * 0.2) / 4);
  const carbsG = (base.carbsG ?? Math.round((base.calories * 0.5) / 4)) + Math.round(extraCals * 0.6 / 4);
  const fatG = (base.fatG ?? Math.round((base.calories * 0.3) / 9)) + Math.round((extraCals * 0.25) / 9);
  const workoutMin = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const waterMl = Math.round((base.waterMl ?? 2800) + (workoutMin / 15) * 150);

  const consumed = await prisma.foodLogEntry.aggregate({
    where: { userId, date: { gte: today } },
    _sum: { calories: true },
  });
  const consumedCalories = Math.round(consumed._sum.calories ?? 0);

  const loadAr = LOAD_AR[load.label as keyof typeof LOAD_AR] ?? load.label;
  const isAdjusted = eligible > 0;
  const reason = isAdjusted
    ? `تم رفع احتياجك الغذائي لليوم بمقدار ${eligible} سعرة لأن نشاطك التدريبي المسجل (${loadAr}) أعلى من المستوى الأساسي، مع تطبيق معامل معاوضة ${Math.round(factor * 100)}%.`
    : 'لم يلاحظ نشاط إضافي مؤهل اليوم، فيبقى هدفك الغذائي على مستواه الأساسي.';

  const adjustments = JSON.stringify({
    goal: profile?.goal ?? base.goal,
    factor,
    activeCalories,
    workoutCalories,
    activityEnergy,
    trainingLoad: load.label,
    loadScore: load.score,
  });

  await prisma.dynamicNutritionTarget.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      baseCalories: base.calories,
      activityCalories: eligible,
      compensationFactor: factor,
      adjustedCalories: adjusted,
      proteinG,
      carbsG,
      fatG,
      waterMl,
      consumedCalories,
      adjustments,
      reason,
      isAdjusted,
    },
    update: {
      baseCalories: base.calories,
      activityCalories: eligible,
      compensationFactor: factor,
      adjustedCalories: adjusted,
      proteinG,
      carbsG,
      fatG,
      waterMl,
      consumedCalories,
      adjustments,
      reason,
      isAdjusted,
    },
  });

  return {
    baseCalories: base.calories,
    activityCalories: eligible,
    compensationFactor: factor,
    adjustedCalories: adjusted,
    proteinG,
    carbsG,
    fatG,
    waterMl,
    consumedCalories,
    trainingLoad: load.label,
    loadScore: load.score,
    reason,
  };
}

// ========================================
// 5. ترجمة تصنيفات الحمل إلى العربية
// ========================================

// LOAD_AR: قاموس بسيط يحوّل تصنيف الحمولة الإنجليزي (من
// computeTrainingLoad) إلى نص عربي ظاهر للمستخدم في الرسالة.
const LOAD_AR = {
  rest: 'راحة',
  light: 'نشاط خفيف',
  moderate: 'نشاط متوسط',
  hard: 'تدريب شاق',
  veryHigh: 'حمل تدريبي مرتفع جدًا',
};

// ========================================
// 6. حالة اليوم الكاملة للوحة + اقتراح الوجبة
// ========================================

/*
-----------------------------------------
الدالة: getTodayState (مصدَّرة)
-----------------------------------------
وظيفتها: تجميع كل ما تحتاجه لوحة السباح "لليوم":
         الهدف الديناميكي المحفوظ + ما استهلكه من طعام وماء +
         المتبقي + نشاط اليوم وتدريباته + اقتراح الوجبة التالية.
Input: userId.
Processing: نقرأ عدة جداول بالتوازي (الهدف الديناميكي، النشاط،
            التدريبات، سجلات الطعام، سجلات الماء)، ثم نجمعها
            في كائن واحد منسق مع أرقام مدورة.
Output: كائن حالة اليوم الكامل.
يستدعيها: الصفحات/واجهات API الخاصة بلوحة اليوم.
ماذا تستدعي: suggestNextMeal (داخل الملف) + prisma.
-----------------------------------------
*/
/** حالة اليوم الكاملة للوحة: الهدف الديناميكي + المستهلك + المتبقي + النشاط. */
export async function getTodayState(userId: string) {
  const today = startOfToday();
  const [target, activity, workouts, foodLogs, waterLogs] = await Promise.all([
    prisma.dynamicNutritionTarget.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.workoutSession.findMany({ where: { userId, startTime: { gte: today } } }),
    prisma.foodLogEntry.findMany({ where: { userId, date: { gte: today } } }),
    prisma.waterLogEntry.findMany({ where: { userId, date: { gte: today } } }),
  ]);

  const consumed = foodLogs.reduce((a, f) => a + (f.calories ?? 0), 0);
  const consumedProtein = foodLogs.reduce((a, f) => a + (f.proteinG ?? 0), 0);
  const consumedCarbs = foodLogs.reduce((a, f) => a + (f.carbsG ?? 0), 0);
  const consumedFat = foodLogs.reduce((a, f) => a + (f.fatG ?? 0), 0);
  const waterMl = waterLogs.reduce((a, w) => a + w.amountMl, 0);

  const adjusted = target?.adjustedCalories ?? 0;
  const remaining = Math.max(0, Math.round(adjusted - consumed));
  const swimDistance = workouts.filter((w) => w.sportType === 'swim').reduce((a, w) => a + (w.distanceM ?? 0), 0);
  const workoutMinutes = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);

  const nextMeal = suggestNextMeal(workouts);

  return {
    date: today,
    dynamic: target
      ? {
          baseCalories: target.baseCalories,
          activityCalories: target.activityCalories,
          compensationFactor: target.compensationFactor,
          adjustedCalories: target.adjustedCalories,
          proteinG: target.proteinG,
          carbsG: target.carbsG,
          fatG: target.fatG,
          waterMl: target.waterMl,
          isAdjusted: target.isAdjusted,
          reason: target.reason,
        }
      : null,
    consumed: {
      calories: Math.round(consumed),
      proteinG: Math.round(consumedProtein * 10) / 10,
      carbsG: Math.round(consumedCarbs * 10) / 10,
      fatG: Math.round(consumedFat * 10) / 10,
      waterMl,
    },
    remainingCalories: remaining,
    activity: activity
      ? {
          steps: activity.steps,
          distanceM: activity.distanceM,
          activeCalories: activity.activeCalories,
          restingCalories: activity.restingCalories,
          totalCaloriesBurned: activity.totalCaloriesBurned,
          workoutMinutes: activity.workoutMinutes,
          sleepMinutes: activity.sleepMinutes,
          avgHeartRate: activity.avgHeartRate,
          restingHeartRate: activity.restingHeartRate,
          trainingLoad: activity.trainingLoad,
          loadScore: activity.loadScore,
          confidence: activity.confidence,
        }
      : null,
    workouts: workouts.map((w) => ({
      id: w.id,
      sportType: w.sportType,
      startTime: w.startTime,
      durationMin: w.durationMin,
      distanceM: w.distanceM,
      caloriesBurned: w.caloriesBurned,
      laps: w.laps,
      swolf: w.swolf,
      avgPacePer100m: w.avgPacePer100m,
      intensity: w.intensity,
      source: w.source,
      provider: w.provider,
    })),
    swimDistanceM: swimDistance,
    workoutMinutes,
    nextMeal,
  };
}

/*
-----------------------------------------
الدالة: suggestNextMeal (داخلية — غير مصدَّرة)
-----------------------------------------
وظيفتها: اقتراح "الوجبة التالية" المناسبة لجدول تدريب اليوم.
Input: قائمة تدريبات اليوم (وقت البدء + نوع الرياضة).
Processing:
  - إذا انتهى آخر تدريب قبل أقل من 3 ساعات ← وجبة استشفاء.
  - وإلا إذا كان هناك تدريب قادم خلال أقل من ساعتين ← وجبة قبل التمرين.
  - وإلا ← الوجبة المخططة العادية.
Output: { type, title, calories, note } أو null.
يستدعيها: getTodayState (داخل هذا الملف).
-----------------------------------------
*/
/** اقتراح الوجبة التالية بناءً على تدريبات اليوم. */
function suggestNextMeal(workouts: Array<{ startTime: Date; sportType: string }>): {
  type: 'preWorkout' | 'recovery' | 'regular';
  title: string;
  calories: string;
  note: string;
} | null {
  const now = Date.now();
  const last = workouts
    .filter((w) => w.startTime.getTime() <= now)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
  if (last && now - last.startTime.getTime() < 3 * 60 * 60 * 1000) {
    return {
      type: 'recovery',
      title: 'وجبة استشفاء بعد التدريب',
      calories: 'كربوهيدرات + بروتين',
      note: 'يفضل خلال ساعة من انتهاء التدريب: كربوهيدرات معتدلة مع مصدر بروتين خفيف وسوائل.',
    };
  }
  const next = workouts.find((w) => w.startTime.getTime() > now);
  if (next && next.startTime.getTime() - now < 2 * 60 * 60 * 1000) {
    return {
      type: 'preWorkout',
      title: 'وجبة قبل التمرين',
      calories: 'كربوهيدرات خفيفة',
      note: 'قبل التمرين بنحو 60-90 دقيقة: كربوهيدرات سهلة الهضم مع بروتين خفيف وترطيب مناسب.',
    };
  }
  return {
    type: 'regular',
    title: 'وجبتك التالية المخططة',
    calories: 'حسب الخطة',
    note: 'سجّل وجباتك وشارك نشاط ساعتك ليُحدَّث الهدف والاقتراحات تلقائيًا.',
  };
}
