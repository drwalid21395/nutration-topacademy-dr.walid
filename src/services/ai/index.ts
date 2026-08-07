/**
 * مصنع مزود الرؤية — يختار المزود تلقائيًا حسب AI_PROVIDER والمفاتيح المتوفرة.
 * القاعدة: mock افتراضيًا. إن وُجد مفتاح حقيقي (openai/gemini) يُستخدم تلقائيًا.
 * كل المفاتيح تُقرأ من متغيرات البيئة فقط، ولا تصل أبدًا إلى المتصفح.
 */
import type { VisionProvider } from './types';
import { mockVisionProvider } from './mock';
import { createOpenAIProvider } from './openai';
import { createGeminiProvider } from './gemini';

export type { VisionProvider, MealAnalysisResult } from './types';
export { ANALYZE_DISCLAIMER } from './types';

export function getVisionProvider(): VisionProvider {
  const provider = process.env.AI_PROVIDER ?? 'mock';

  if (provider === 'openai' || process.env.OPENAI_API_KEY) {
    return createOpenAIProvider();
  }
  if (provider === 'gemini' || process.env.GEMINI_API_KEY) {
    return createGeminiProvider();
  }
  return mockVisionProvider;
}

export const activeProviderName = (): string => {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'mock';
};
