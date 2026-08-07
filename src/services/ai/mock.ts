/**
 * محلل تجريبي (Mock) — يعمل بدون أي مفتاح API.
 * لا يفحص الصورة فعليًا، لذا يعيد تقديرًا عامًا موضحًا أنه محاكاة،
 * ولا يدّعي التعرف على أطعمة حقيقية (لتجنب نتائج مضللة مثل بيزا ← بطاطس).
 * عند ربط مفتاح حقيقي يتم استخدام OpenAI/Gemini تلقائيًا لتحليل الصورة فعليًا.
 */
import type { VisionProvider } from './types';
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

export const MOCK_WARNING =
  'وضع المحاكاة (بدون مفتاح API): لا يفحص النظام الصورة فعليًا، والنتائج أدناه تقديرات تجريبية عامة قابلة للتعديل. لتحليل دقيق حقيقي للصورة أضف مفتاح OpenAI أو Gemini أو Groq في متغيرات البيئة.';

const PLACEHOLDERS: { nameAr: string; nameEn: string; cals: number; p: number; c: number; f: number; fbr: number; na: number }[] = [
  { nameAr: 'مكوّن تقديري (محاكاة)', nameEn: 'simulated component', cals: 210, p: 14, c: 22, f: 7, fbr: 2, na: 180 },
  { nameAr: 'جانب تقديري (محاكاة)', nameEn: 'simulated side', cals: 120, p: 4, c: 18, f: 3, fbr: 2, na: 120 },
  { nameAr: 'مشروب تقديري (محاكاة)', nameEn: 'simulated drink', cals: 90, p: 1, c: 22, f: 0, fbr: 0, na: 10 },
];

export const mockVisionProvider: VisionProvider = {
  name: 'mock',
  async analyze(_imageDataUrl: string): Promise<MealAnalysisResult> {
    // محاكاة زمن التحليل
    await new Promise((r) => setTimeout(r, 1000));

    const foods: AnalyzedFood[] = PLACEHOLDERS.map((ph) => ({
      nameAr: ph.nameAr,
      nameEn: ph.nameEn,
      grams: 150,
      calories: ph.cals,
      proteinG: ph.p,
      carbsG: ph.c,
      fatG: ph.f,
      fiberG: ph.fbr,
      sodiumMg: ph.na,
    }));

    return {
      provider: 'mock',
      isEstimate: true,
      confidence: 30,
      foods,
      totalCalories: foods.reduce((a, f) => a + (f.calories ?? 0), 0),
      totalProteinG: foods.reduce((a, f) => a + (f.proteinG ?? 0), 0),
      totalCarbsG: foods.reduce((a, f) => a + (f.carbsG ?? 0), 0),
      totalFatG: foods.reduce((a, f) => a + (f.fatG ?? 0), 0),
      totalFiberG: foods.reduce((a, f) => a + (f.fiberG ?? 0), 0),
      totalSodiumMg: foods.reduce((a, f) => a + (f.sodiumMg ?? 0), 0),
      needsReview: true,
      notes: MOCK_WARNING,
    };
  },
};
