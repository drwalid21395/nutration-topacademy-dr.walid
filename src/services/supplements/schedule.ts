/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/supplements/schedule.ts

وظيفة الملف:
"توقيت المكملات" — يبني جدولًا ذكيًا يربط كل مكمل بموعده
(الصباح، قبل التدريب، أثناءه، بعده، مع الوجبات، قبل النوم)،
ويراعي يوم الراحة ويوم البطولة، ويمنع تكرار المكونات نفسها.

لماذا نحتاجه؟
التوقيت يصنع الفرق: مكمل يؤخذ قبل التدريب وآخر بعده وآخر مع
الوجبة. الجدول يوضح للسباح متى يأخذ ماذا وبأي سبب.

متى يعمل؟
داخل generateSupplementAssessment (assessment.ts) في قسم الجدول،
بعد تجهيز التوصيات المقترحة (needs-review).

من يستدعي هذا الملف؟
- supplements/assessment.ts → generateSupplementSchedule.

الملفات التي يتعامل معها:
- ./types → ScheduleRow (شكل الصف).
- التوصيات تأتي من التقييم في assessment.ts.

ترتيب العمل:
توصيات مقترحة + أوقات اليوم (استيقاظ/تدريب/نوم) ↓
ترتيب المكملات حسب موضعها الزمني (صباح ← قبل تدريب ← أثناء ← بعد ← مع وجبة ← مساء) ↓
توليد سطر لكل مكمل مع الوقت والسبب ↓
منع تكرار المكونات وإضافة صف احتياطي إن لم توجد توصيات

ملاحظة مهمة:
جدول استرشادي يُراجع مع المختص؛ المكملات الخاصة بيوم البطولة
لا تُجرَّب قبل السباق أبدًا.
==================================================
*/

/**
 * توقيت المكملات — جدول ذكي يربط التوقيت بمواعيد الوجبات والتدريب والنوم
 * ويوم الراحة ويوم البطولة، مع منع الجمع المكرر للمكونات نفسها.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// شكل الصف من الأنواع المشتركة (استيراد نوع فقط).
import type { ScheduleRow } from './types';

// ========================================
// 2. الأنواع والثوابت
// ========================================

// كل المدخلات: التوصيات + الأوقات اليومية + حالة اليوم (راحة/بطولة).
export interface ScheduleInput {
  recommendations: { key: string; nameAr: string; dose: string; withFood: boolean; timingAr?: string; durationDays?: number | null; competitionOnly?: boolean }[];
  wakeTime?: string;
  swimTime?: string;
  gymTime?: string;
  sleepTime?: string;
  restDay?: boolean;
  competitionDay?: boolean;
}

// توقيتات افتراضية عربية شائعة (تُستخدم إن لم يحدد المستخدم أوقاته).
export const DEFAULT_TIMES = {
  wake: '06:30',
  swim: '16:30',
  gym: '08:00',
  sleep: '23:00',
};

// ترتيب المواضع الزمنية: 1 صباحًا ← 6 مساءً (لترتيب الجدول).
const ORDER: Record<string, number> = {
  morning: 1,
  beforeWorkout: 2,
  during: 3,
  afterWorkout: 4,
  withMeals: 5,
  evening: 6,
};

/*
-----------------------------------------
الدالة: slotOf
-----------------------------------------
وظيفتها: تحويل نص التوقيت (timingAr) إلى رقم ترتيبي للمقارنة.
Input: نص عربي للتوقيت (قد يكون غير متوفر).
Processing: البحث عن كلمات مفتاحية (صباح، قبل التدريب، أثناء،
  بعد التدريب، مع وجبة، مساء/قبل النوم) وإرجاع رقم الترتيب.
Output: رقم من 1 إلى 6، أو 99 للتوقيت غير المعروف.
-----------------------------------------
*/
function slotOf(timingAr?: string): number {
  if (!timingAr) return 99;
  if (timingAr.includes('صباح')) return ORDER.morning;
  if (timingAr.includes('قبل التدريب') || timingAr.includes('قبل السباق')) return ORDER.beforeWorkout;
  if (timingAr.includes('أثناء')) return ORDER.during;
  if (timingAr.includes('بعد التدريب') || timingAr.includes('بعد السباق')) return ORDER.afterWorkout;
  if (timingAr.includes('مع وجبة') || timingAr.includes('مع الطعام')) return ORDER.withMeals;
  if (timingAr.includes('مساء') || timingAr.includes('قبل النوم')) return ORDER.evening;
  return 99;
}

// ========================================
// 3. الدالة الرئيسية
// ========================================

/*
-----------------------------------------
الدالة: generateSupplementSchedule
-----------------------------------------
وظيفتها: توليد الجدول اليومي للمكملات المقترحة.
Input: ScheduleInput (التوصيات + الأوقات + حالة اليوم).
Processing:
  1. ترتيب التوصيات حسب موضعها الزمني.
  2. المكملات الخاصة بيوم البطولة: تُوضع في صف منفصل لليوم فقط.
  3. منع تكرار المكونات (Set) — كل مكون مرة واحدة.
  4. تحويل كل توصية إلى صف: الوقت + السبب، مع دمج أوقات اليوم.
  5. إن لم توجد توصيات: صف احتياطي "لا توجد مكملات موصى بها".
Output: ScheduleRow[].
يُستدعى من: assessment.ts في قسم الجدول.
-----------------------------------------
*/
export function generateSupplementSchedule(input: ScheduleInput): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const seenIngredient = new Set<string>();

  const items = [...input.recommendations].sort((a, b) => slotOf(a.timingAr) - slotOf(b.timingAr));

  for (const r of items) {
    if (r.competitionOnly && !input.competitionDay && !input.restDay) {
      rows.push({
        time: 'يوم البطولة فقط',
        item: r.nameAr,
        dose: r.dose,
        withFood: r.withFood,
        reason: 'مخصّص ليوم السباق — لا يُجرَّب قبل البطولة.',
        onRestDay: false,
        onCompetitionDay: true,
      });
      continue;
    }
    if (seenIngredient.has(r.key)) continue; // منع تكرار المكونات
    seenIngredient.add(r.key);

    let time = r.timingAr ?? 'مع الوجبات';
    let reason = 'حسب الملف العلمي للمكمل.';
    if (r.timingAr?.includes('صباح')) {
      time = `${input.wakeTime ?? DEFAULT_TIMES.wake} — الصباح`;
      reason = 'مبكرًا مع وجبة الإفطار (قبل التمرين عند الحاجة).';
    } else if (r.timingAr?.includes('قبل التدريب')) {
      time = `قبل التمرين بـ 30-60 دقيقة (~${input.swimTime ?? DEFAULT_TIMES.swim})`;
      reason = 'التوقيت المرتبط بالتدريب لتحقيق الفائدة المقصودة.';
    } else if (r.timingAr?.includes('بعد التدريب')) {
      time = `خلال 30-60 دقيقة بعد التمرين (~${input.swimTime ?? DEFAULT_TIMES.swim})`;
      reason = 'نافذة ما بعد التمرين لتعويض وإصلاح العضلات.';
    } else if (r.timingAr?.includes('قبل النوم')) {
      time = `قبل النوم بـ 30-60 دقيقة (~${input.sleepTime ?? DEFAULT_TIMES.sleep})`;
      reason = 'توقيت مسائي مرتبط بالنوم والاستشفاء.';
    }

    rows.push({
      time,
      item: r.nameAr,
      dose: r.dose,
      withFood: r.withFood,
      reason,
      onRestDay: !!input.restDay,
      onCompetitionDay: !!input.competitionDay,
    });
  }

  if (rows.length === 0) {
    rows.push({
      time: '—',
      item: 'لا توجد مكملات موصى بها حاليًا',
      dose: '—',
      withFood: true,
      reason: 'الغذاء والنوم والترطيب أولًا.',
      onRestDay: !!input.restDay,
      onCompetitionDay: !!input.competitionDay,
    });
  }

  return rows;
}
