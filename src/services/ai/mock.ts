/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/ai/mock.ts

وظيفة الملف:
"محلّل تجريبي (Mock)" — يعمل بدون أي مفتاح API. لا يفحص الصورة
فعليًا، بل يعيد تقديرات عامة ثابتة موضحًا أنها محاكاة،
حتى لا تظهر نتائج مضللة توحي بالتعرف على أطعمة حقيقية.

لماذا نحتاجه؟
حتى يبقى الموقع قابلًا للتجربة في بيئة التطوير بدون مفاتيح مدفوعة،
وعند ربط مفتاح حقيقي يُستبدل هذا المحلل تلقائيًا بـ OpenAI/Gemini/Groq.

متى يعمل؟
افتراضيًا عند غياب جميع مفاتيح API الخاصة بالتحليل البصري.

من يستدعي هذا الملف؟
كود اختيار المزود في services/ai — عبر mockVisionProvider.

الملفات التي يتعامل معها:
- ./types → VisionProvider.
- @/types → MealAnalysisResult و AnalyzedFood.

ترتيب العمل:
رفع صورة (لا تُفحص فعلًا) ↓
انتظار ثانية لمحاكاة زمن التحليل ↓
بناء 3 عناصر تقديرية ثابتة وعدّها كنتيجة "تقديرية للمراجعة"

ملاحظة مهمة:
هذه طبقة "منطق أعمال" — نتيجة المحاكاة للعرض والتجربة فقط،
وليس تحليلًا حقيقيًا.
==================================================
*/

/**
 * محلل تجريبي (Mock) — يعمل بدون أي مفتاح API.
 * لا يفحص الصورة فعليًا، لذا يعيد تقديرًا عامًا موضحًا أنه محاكاة،
 * ولا يدّعي التعرف على أطعمة حقيقية (لتجنب نتائج مضللة مثل بيزا ← بطاطس).
 * عند ربط مفتاح حقيقي يتم استخدام OpenAI/Gemini تلقائيًا لتحليل الصورة فعليًا.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// VisionProvider: واجهة المزود الموحدة (ملف محلي).
import type { VisionProvider } from './types';
// MealAnalysisResult و AnalyzedFood من مجلد الأنواع الرئيسي.
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

// ========================================
// 2. الثوابت
// ========================================

// رسالة تحذير تُعرض مع النتيجة لتنبيه المستخدم أنها محاكاة
// وتحتاج مفتاح API حقيقي للتحليل الدقيق.
export const MOCK_WARNING =
  'وضع المحاكاة (بدون مفتاح API): لا يفحص النظام الصورة فعليًا، والنتائج أدناه تقديرات تجريبية عامة قابلة للتعديل. لتحليل دقيق حقيقي للصورة أضف مفتاح OpenAI أو Gemini أو Groq في متغيرات البيئة.';

// قائمة ثابتة من عناصر "تقديرية" (سعرات ومغذيات جاهزة) تُرجعها المحاكاة.
const PLACEHOLDERS: { nameAr: string; nameEn: string; cals: number; p: number; c: number; f: number; fbr: number; na: number }[] = [
  { nameAr: 'مكوّن تقديري (محاكاة)', nameEn: 'simulated component', cals: 210, p: 14, c: 22, f: 7, fbr: 2, na: 180 },
  { nameAr: 'جانب تقديري (محاكاة)', nameEn: 'simulated side', cals: 120, p: 4, c: 18, f: 3, fbr: 2, na: 120 },
  { nameAr: 'مشروب تقديري (محاكاة)', nameEn: 'simulated drink', cals: 90, p: 1, c: 22, f: 0, fbr: 0, na: 10 },
];

// ========================================
// 3. المحلل التجريبي (Mock Vision Provider)
// ========================================

/*
-----------------------------------------
الكائن: mockVisionProvider
-----------------------------------------
وظيفته: محاكاة تحليل صورة وجبة دون الاتصال بأي خدمة.
Input: رابط الصورة (لكنه لا يُستخدم فعليًا).
Processing:
  1. انتظار 1 ثانية لمحاكاة زمن تحليل حقيقي.
  2. بناء 3 عناصر طعام من PLACEHOLDERS.
  3. حساب المجاميع الكلية وجمع التحذير MOCK_WARNING.
Output: MealAnalysisResult بثقة منخفضة (30).
من يستدعيه؟ كود اختيار المزود عند غياب كل مفاتيح API.
-----------------------------------------
*/
export const mockVisionProvider: VisionProvider = {
  name: 'mock',
  async analyze(_imageDataUrl: string): Promise<MealAnalysisResult> {
    // محاكاة زمن التحليل
    await new Promise((r) => setTimeout(r, 1000));

    // تحويل كل عنصر تقديري إلى AnalyzedFood بوزن افتراضي 150 جم.
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

    // تجميع النتيجة مع المجاميع المحسوبة يدويًا (جمع بسيط) وتحذير المحاكاة.
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
