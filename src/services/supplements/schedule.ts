/**
 * توقيت المكملات — جدول ذكي يربط التوقيت بمواعيد الوجبات والتدريب والنوم
 * ويوم الراحة ويوم البطولة، مع منع الجمع المكرر للمكونات نفسها.
 */
import type { ScheduleRow } from './types';

export interface ScheduleInput {
  recommendations: { key: string; nameAr: string; dose: string; withFood: boolean; timingAr?: string; durationDays?: number | null; competitionOnly?: boolean }[];
  wakeTime?: string;
  swimTime?: string;
  gymTime?: string;
  sleepTime?: string;
  restDay?: boolean;
  competitionDay?: boolean;
}

/** توقيتات افتراضية عربية شائعة */
export const DEFAULT_TIMES = {
  wake: '06:30',
  swim: '16:30',
  gym: '08:00',
  sleep: '23:00',
};

const ORDER: Record<string, number> = {
  morning: 1,
  beforeWorkout: 2,
  during: 3,
  afterWorkout: 4,
  withMeals: 5,
  evening: 6,
};

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
