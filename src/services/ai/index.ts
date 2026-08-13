/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/ai/index.ts

وظيفة الملف:
"المصنع" (Factory) الذي يختار مزود الذكاء الاصطناعي المناسب
لتحليل الوجبات بالكاميرا حسب متغيرات البيئة المتوفرة.

من هم المزودون؟
- mock: تقدير محلي (بدون إنترنت) — الافتراضي عند التجربة.
- openai: OpenAI Vision (إذا وُجد OPENAI_API_KEY).
- gemini: Gemini Vision (إذا وُجد GEMINI_API_KEY).
- groq: Groq Vision (إذا وُجد GROQ_API_KEY).

لماذا نحتاجه؟
حتى لا نربط الكود بمزود واحد. لو غيّرنا المزود أو أضفنا
مفتاحًا جديدًا، كل شيء يعمل تلقائيًا دون تعديل الصفحات.

قاعدة أمان مهمة:
كل المفاتيح تُقرأ من متغيرات البيئة (process.env) فقط —
لا تصل أبدًا للمتصفح. (لو كتبت المفتاح في الكود، أي زائر
يستطيع قراءته!)

متى يعمل؟
عند فتح صفحة المحلل (activeProviderName) وعند طلب التحليل
(getVisionProvider من واجهة /api/analyze-meal).

العلاقة مع الملفات:
- openai.ts / gemini.ts / groq.ts / mock.ts: تعريفات المزودين.
- types.ts: الواجهة المشتركة بينهم.
==================================================
*/

/**
 * مصنع مزود الرؤية — يختار المزود تلقائيًا حسب AI_PROVIDER والمفاتيح المتوفرة.
 * القاعدة: mock افتراضيًا. إن وُجد مفتاح حقيقي (openai/gemini) يُستخدم تلقائيًا.
 * كل المفاتيح تُقرأ من متغيرات البيئة فقط، ولا تصل أبدًا إلى المتصفح.
 */

// ========================================
// 1. الاستيرادات
// ========================================

// VisionProvider: "الواجهة" (interface) المشتركة — أي مزود
// يجب أن يطابق هذا الشكل (دالة analyzeMeal...).
import type { VisionProvider } from './types';
import { mockVisionProvider } from './mock';
import { createOpenAIProvider } from './openai';
import { createGeminiProvider } from './gemini';
import { createGroqProvider } from './groq';

// نعيد تصدير الأنواع والتنبيهات لاستخدامها خارج الملف.
export type { VisionProvider, MealAnalysisResult } from './types';
export { ANALYZE_DISCLAIMER } from './types';

// ========================================
// 2. اختيار المزود
// ========================================

/*
-----------------------------------------
الدالة: getVisionProvider
-----------------------------------------
وظيفتها: إرجاع مزود التحليل المناسب.
Input: لا شيء (يقرأ متغيرات البيئة).
Output: VisionProvider.

ترتيب الاختيار:
1. AI_PROVIDER = openai أو يوجد OPENAI_API_KEY → OpenAI.
2. AI_PROVIDER = gemini أو يوجد GEMINI_API_KEY → Gemini.
3. AI_PROVIDER = groq أو يوجد GROQ_API_KEY → Groq.
4. وإلا → mock (تقدير محلي).

ملاحظة: لو أنت في وضع mock فتحليل الوجبات "تقديري"
باستخدام أسماء أطعمة معروفة — انظر MOCK_WARNING.
-----------------------------------------
*/
export function getVisionProvider(): VisionProvider {
  // AI_PROVIDER: متغير بيئة يحدد المزود يدويًا (اختياري).
  const provider = process.env.AI_PROVIDER ?? 'mock';

  // لو النوع openai، أو حتى لو المفتاح موجود فقط → استخدم OpenAI.
  if (provider === 'openai' || process.env.OPENAI_API_KEY) {
    return createOpenAIProvider();
  }
  if (provider === 'gemini' || process.env.GEMINI_API_KEY) {
    return createGeminiProvider();
  }
  if (provider === 'groq' || process.env.GROQ_API_KEY) {
    return createGroqProvider();
  }
  // لا مفتاح حقيقي → مزود المحاكاة المحلي.
  return mockVisionProvider;
}

/*
-----------------------------------------
الدالة: activeProviderName
-----------------------------------------
وظيفتها: إرجاع اسم المزود النشط (نص).
Output: 'openai' | 'gemini' | 'groq' | 'mock'.
يتم استدعاؤها من: صفحة المحلل (لإظهار شارة المزود).
-----------------------------------------
*/
export const activeProviderName = (): string => {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'mock';
};
