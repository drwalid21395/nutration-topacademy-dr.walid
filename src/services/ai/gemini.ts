/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/ai/gemini.ts

وظيفة الملف:
"مزود جوجل Gemini لتحليل صور الوجبات" — يرسل صورة الوجبة إلى
نموذج Gemini، ويحوّل رده النصي (JSON) إلى نتيجة منظمة جاهزة للعرض.

لماذا نحتاجه؟
تحليل الصور الحقيقي يحتاج مفتاح API خارجي. هذا الملف يسمح للموقع
بتحليل صور وجبات فعلية عند توفر GEMINI_API_KEY بدل المحاكاة الافتراضية.

متى يعمل؟
عند طلب "تحليل بالصورة" مع ضبط GEMINI_API_KEY في متغيرات البيئة،
وتحديدًا من كود اختيار المزود (Vision Provider).

من يستدعي هذا الملف؟
كود اختيار المزود في services/ai — عبر الدالة createGeminiProvider.

الملفات التي يتعامل معها:
- ./types → VisionProvider (واجهة موحدة لكل المزودات).
- @/types → MealAnalysisResult و AnalyzedFood.
- mock.ts و openai.ts و groq.ts → مزودات أخرى بنفس الواجهة.

ترتيب العمل:
يرفع المستخدم صورة وجبة ↓
تُرسل الصورة + التعليمات إلى واجهة Gemini عبر fetch ↓
نستقبل ردًا نصيًا يحوي JSON ↓
normalize يحوّله إلى نتيجة MealAnalysisResult منظمة

ملاحظة مهمة:
هذه طبقة "منطق أعمال" — لا تعرض واجهة، بل تتصل بخدمة خارجية
عبر fetch وتعيد نتيجة موحدة للمتصل.
==================================================
*/

/**
 * مزود Gemini Vision — يُستدعى عند توفر GEMINI_API_KEY.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// VisionProvider: واجهة موحدة تحدد شكل أي مزود (name + analyze).
// ملف محلي من نفس مجلد ai.
import type { VisionProvider } from './types';
// MealAnalysisResult: نتيجة تحليل الوجبة كاملة.
// AnalyzedFood: عنصر طعام مفرد (اسم، جرامات، سعرات، مغذيات...).
// كلاهما من مجلد الأنواع الرئيسي src/types.
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

// ========================================
// 2. التعليمات (PROMPT) المرسلة للنموذج
// ========================================

// نص تعليمات بالعربية يخبر النموذج كيف يحلل الوجبة ويقدّر المكونات.
// يطلب منه إرجاع JSON خالص فقط (بدون أي نص زائد) لأننا سنحوله
// إلى كائن برمجي عبر JSON.parse مباشرة.
const PROMPT = `أنت خبير تغذية رياضية متخصص بقياس الحصص الغذائية من الصور بدقة عالية. حلل الوجبة في الصورة وقدّر المكونات.

المطلوب: إرجاع JSON خالص فقط (بدون أي نص آخر) بالصيغة التالية:
{"foods":[{"nameAr":"اسم الطعام بالعربية","nameEn":"اسم الطعام بالإنجليزية","grams":وزن تقريبي بالجرام,"calories":سعرات حرارية,"proteinG":بروتين,"carbsG":كربوهيدرات,"fatG":دهون,"fiberG":ألياف,"sodiumMg":صوديوم}],"confidence":درجة الثقة من 0 إلى 100,"notes":"ملاحظات غذائية قصيرة"}

قواعد الدقة:
1. قدّر حجم الحصة بالجرام مقارنة بأحجام قياسية (كف اليد، كوب، كرة التنس، طبق عشاء).
2. استخدم قيمًا غذائية علمية لكل 100 جرام من مكونات الوجبة الشائعة.
3. لا تختلق مكونات غير ظاهرة في الصورة.
4. اعتمد السعرات والمغذيات لكل طعام على الوزن المقدَّر للحصة الفعلية.
5. إن كانت الصورة ليست وجبة، أعد {"foods":[],"confidence":0,"notes":"الصورة لا تبدو وجبة طعام"}.`;

// ========================================
// 3. الدالة الرئيسية: إنشاء مزود Gemini
// ========================================

/*
-----------------------------------------
الدالة: createGeminiProvider
-----------------------------------------
وظيفتها: تُرجع كائن "مزود" جاهزًا يتوافق مع واجهة VisionProvider.
Input: بلا مدخلات.
Processing:
  1. تقرأ GEMINI_API_KEY ونموذج الرؤية من متغيرات البيئة.
  2. ترسل الصورة (base64) مع التعليمات إلى واجهة Gemini عبر fetch.
  3. تنظف نص الرد من علامات ```json ثم تحوّله إلى كائن JSON.
  4. normalize يحوّل الأرقام إلى قيم سليمة ومنظمة.
Output: VisionProvider جاهز للاستخدام.
من يستدعيها؟ كود اختيار المزود عند توفر مفتاح Gemini.
ماذا تستدعي هي؟ خدمة Gemini الخارجية + normalize.
-----------------------------------------
*/
export function createGeminiProvider(): VisionProvider {
  return {
    name: 'gemini',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      // نقرأ المفتاح والنموذج من متغيرات البيئة (سرّ لا يُرفع للمتجر).
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_VISION_MODEL ?? 'gemini-2.5-flash';
      // بدون مفتاح لا نستطيع إجراء التحليل فنرفض بوضوح.
      if (!apiKey) throw new Error('GEMINI_API_KEY غير مضبوط في متغيرات البيئة');

      // إرسال طلب POST لواجهة Gemini مع الصورة كبيانات base64.
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  // الجزء النصي: التعليمات. الجزء البصري: الصورة.
                  { text: PROMPT },
                  // نستخرج نوع الصورة (مثل image/jpeg) والبيانات من نص base64.
                  { inline_data: { mime_type: imageDataUrl.split(',')[0].split(';')[0].replace('data:', ''), data: imageDataUrl.split(',')[1] } },
                ],
              },
            ],
            // درجة حرارة منخفضة = إجابات أدق وأقل إبداعًا، وحد أقصى للرموز.
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
          }),
        }
      );

      // إن فشل الاتصال نرفع خطأً واضحًا برقم الحالة.
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`فشل استدعاء Gemini (${res.status})`);
      }

      // نصل إلى النص داخل بنية الرد: candidates ← content ← parts ← text.
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      // إزالة علامات ```json و ``` (قد يلفها النموذج بها) ثم تحويلها لكائن.
      const cleaned = text.replace(/```json|```/g, '').trim();
      const json = JSON.parse(cleaned);

      // نحول الكائن الخام إلى النتيجة الموحدة النظيفة.
      return normalize(json, 'gemini');
    },
  };
}

// ========================================
// 4. الدالة المساعدة: توحيد النتيجة
// ========================================

/*
-----------------------------------------
الدالة: normalize
-----------------------------------------
وظيفتها: تحويل كائن JSON الخام الذي رجعه النموذج إلى MealAnalysisResult
منظمة بأرقام سليمة (دالة pure function: لا تُغيّر أي شيء خارجها).
Processing:
  - تجهيز قائمة الأطعمة بأرقام مقربة (جرامات، سعرات، مغذيات).
  - حساب المجاميع الكلية عبر الجمع (reduce).
  - ضبط قيم افتراضية عند غياب أي حقل (مثل ?? 70 للثقة).
Output: MealAnalysisResult.
من يستدعيها؟ analyze داخل هذا الملف.
-----------------------------------------
*/
function normalize(json: Record<string, unknown>, provider: string): MealAnalysisResult {
  // نقرأ قائمة الأطعمة إن كانت مصفوفة، وإلا قائمة فارغة.
  // Math.round للتقريب، و (x*10)/10 للاحتفاظ بمنزلة عشرية واحدة.
  const foods: AnalyzedFood[] = Array.isArray(json.foods)
    ? (json.foods as AnalyzedFood[]).map((f) => ({
        nameAr: f.nameAr ?? 'طعام',
        nameEn: f.nameEn,
        grams: Math.round(f.grams ?? 100),
        calories: Math.round(f.calories ?? 0),
        proteinG: Math.round((f.proteinG ?? 0) * 10) / 10,
        carbsG: Math.round((f.carbsG ?? 0) * 10) / 10,
        fatG: Math.round((f.fatG ?? 0) * 10) / 10,
        fiberG: Math.round((f.fiberG ?? 0) * 10) / 10,
        sodiumMg: Math.round(f.sodiumMg ?? 0),
      }))
    : [];

  // نرجع النتيجة الكاملة مع المجاميع المحسوبة والتحذير بالمراجعة.
  return {
    provider,
    isEstimate: true,
    confidence: Number(json.confidence ?? 70),
    foods,
    totalCalories: Math.round(foods.reduce((a, f) => a + (f.calories ?? 0), 0)),
    totalProteinG: Math.round(foods.reduce((a, f) => a + (f.proteinG ?? 0), 0) * 10) / 10,
    totalCarbsG: Math.round(foods.reduce((a, f) => a + (f.carbsG ?? 0), 0) * 10) / 10,
    totalFatG: Math.round(foods.reduce((a, f) => a + (f.fatG ?? 0), 0) * 10) / 10,
    totalFiberG: Math.round(foods.reduce((a, f) => a + (f.fiberG ?? 0), 0) * 10) / 10,
    totalSodiumMg: Math.round(foods.reduce((a, f) => a + (f.sodiumMg ?? 0), 0)),
    needsReview: true,
    notes: typeof json.notes === 'string' ? json.notes : undefined,
    raw: json,
  };
}
