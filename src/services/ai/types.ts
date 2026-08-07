import type { MealAnalysisResult } from '@/types';

export type { MealAnalysisResult };

export interface VisionProvider {
  name: string;
  analyze(imageDataUrl: string): Promise<MealAnalysisResult>;
}

export const ANALYZE_DISCLAIMER =
  'تحليل الصور تقديري بالذكاء الاصطناعي وقد يختلف عن الواقع بسبب طريقة الطهي والزيوت والصلصات وحجم الحصة. لا يقدّم النظام رقمًا دقيقًا بنسبة 100%، والنتيجة للمراجعة قبل إضافتها للسجل.';
