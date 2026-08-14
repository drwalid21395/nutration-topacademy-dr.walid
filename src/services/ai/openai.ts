/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/ai/openai.ts

وظيفة الملف:
"مزود OpenAI لتحليل صور الوجبات" — يرسل الصورة (base64) مع تعليمات
منظمة إلى نموذج OpenAI، ثم يحوّل الرد النصي إلى نتيجة موحدة.
كما يحتوي دالتي مساعدة يُعاد استخدامهما في مزود Groq:
- extractJson: استخراج JSON من نص الرد حتى لو كان محاطًا بكلام.
- normalizeOpenAIResult: توحيد النتيجة.

لماذا نحتاجه؟
أحد مزودات التحليل الحقيقي عند توفر OPENAI_API_KEY،
ويعتبر الأساس الذي تعتمد عليه Groq.

متى يعمل؟
عند طلب "تحليل بالصورة" مع ضبط OPENAI_API_KEY في متغيرات البيئة.

من يستدعي هذا الملف؟
- كود اختيار المزود → createOpenAIProvider.
- groq.ts → extractJson و normalizeOpenAIResult.

الملفات التي يتعامل معها:
- ./types → VisionProvider.
- @/types → MealAnalysisResult و AnalyzedFood.

ترتيب العمل:
رفع صورة الوجبة ↓
إرسالها لنموذج OpenAI بصيغة chat/completions ↓
استخراج نص الرد ← extractJson ← normalizeOpenAIResult

ملاحظة مهمة:
هذه طبقة "منطق أعمال" — تتصل بخدمة خارجية عبر fetch،
والنتيجة تقديرية (isEstimate) وليست قياسًا دقيقًا.
==================================================
*/

/**
 * مزود OpenAI Vision — يُستدعى عند توفر OPENAI_API_KEY.
 * يرسل الصورة base64 مع تعليمات تحليل منظمة JSON.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// VisionProvider: الواجهة الموحدة (ملف محلي).
import type { VisionProvider } from './types';
// MealAnalysisResult و AnalyzedFood من مجلد الأنواع الرئيسي.
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

// ========================================
// 2. التعليمات (SYSTEM_PROMPT) المرسلة للنموذج
// ========================================

// تعليمات عربية تطلب JSON خالصًا بالصيغة المطلوبة،
// مع التنبيه أن الطهي والزيوت والصلصات تغيّر القيم التقديرية.
const SYSTEM_PROMPT = `أنت خبير تغذية رياضية يحلل صور وجبات السباحين. أعد إجابة JSON خالصة بدون أي نص آخر بالصيغة التالية:
{
  "foods": [
    { "nameAr": "اسم الطعام بالعربية", "nameEn": "english name", "grams": 150, "calories": 250, "proteinG": 20, "carbsG": 30, "fatG": 8, "fiberG": 3, "sodiumMg": 200 }
  ],
  "confidence": 75,
  "notes": "ملاحظات قصيرة عن الحصة والطهي"
}
قدر الأوزان والسعرات تقريبًا حسب حجم الحصة الظاهر. لاحظ أن الطهي والزيوت والصلصات تغير القيم.`;

// ========================================
// 3. الدالة الرئيسية: إنشاء مزود OpenAI
// ========================================

/*
-----------------------------------------
الدالة: createOpenAIProvider
-----------------------------------------
وظيفتها: تُرجع مزودًا جاهزًا يتوافق مع واجهة VisionProvider.
Input: بلا مدخلات.
Processing:
  1. قراءة OPENAI_API_KEY والنموذج من متغيرات البيئة.
  2. إرسال الصورة مع التعليمات إلى api.openai.com عبر fetch.
  3. استخراج نص الرد ثم extractJson ثم normalizeOpenAIResult.
Output: VisionProvider.
من يستدعيها؟ كود اختيار المزود عند توفر مفتاح OpenAI.
ماذا تستدعي هي؟ خدمة OpenAI + extractJson + normalizeOpenAIResult.
-----------------------------------------
*/
export function createOpenAIProvider(): VisionProvider {
  return {
    name: 'openai',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      // المفتاح والنموذج من متغيرات البيئة.
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini';
      // بدون مفتاح لا يمكن التحليل الحقيقي.
      if (!apiKey) throw new Error('OPENAI_API_KEY غير مضبوط في متغيرات البيئة');

      // طلب POST بصيغة chat/completions مع الصورة كرابط base64.
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1200,
          messages: [
            // دور النموذج + دور المستخدم (نص + صورة).
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'حلل الوجبة في الصورة:' },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });

      // فشل الاتصال → خطأ واضح.
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`فشل استدعاء OpenAI (${res.status})`);
      }

      // الوصول لنص الرد داخل choices ← message ← content.
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      // تنظيف النص واستخراج JSON ثم توحيد النتيجة.
      return normalizeOpenAIResult(extractJson(content), 'openai');
    },
  };
}

// ========================================
// 4. الدالة المساعدة: استخراج JSON من النص
// ========================================

/*
-----------------------------------------
الدالة: extractJson
-----------------------------------------
وظيفتها: إيجاد كائن JSON داخل نص الرد مهما كان محيطه.
Processing:
  1. إزالة أجزاء <think>...</think> (أفكار النموذج الداخلية).
  2. البحث عن كتلة ```json ... ``` إن وجدت، وإلا النص كاملًا.
  3. قص ما بين أول { وآخر } ومحاولة JSON.parse.
  4. لو فشل القص، نحاول تحليل النص كاملًا.
Output: كائن Record<string, unknown>.
من يستدعيها؟ openai.ts و groq.ts.
-----------------------------------------
*/
/** استخراج JSON من نص الرد (يتحمل كود markdown أو نص حول الـ JSON) */
export function extractJson(content: string): Record<string, unknown> {
  // إزالة المسافات البادئة/اللاحقة، ثم حذف كتل <think> التي يضيفها بعض النماذج.
  let trimmed = content.trim();
  trimmed = trimmed.replace(/<think>[\s\S]*?<\/think>/g, '');
  // إن كان الرد داخل فواصل markdown ``` نأخذ ما بينهما فقط.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : trimmed;
  // نبحث عن أول { وآخر } (أي نطاق كائن JSON) لقصه وتحليله.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      /* سقط في الأقل الموقع — جرب parsing كامل أدناه */
    }
  }
  // محاولة أخيرة: تحليل النص كاملًا.
  return JSON.parse(candidate);
}

// ========================================
// 5. الدالة المساعدة: توحيد نتيجة OpenAI
// ========================================

/*
-----------------------------------------
الدالة: normalizeOpenAIResult
-----------------------------------------
وظيفتها: تحويل الكائن الخام من النموذج إلى MealAnalysisResult منظمة
بأرقام سليمة (دالة pure function بلا تأثيرات جانبية).
Processing:
  - تجهيز الأطعمة بقيم مقربة (جرامات، سعرات، مغذيات).
  - حساب المجاميع الكلية عبر reduce.
  - قيم افتراضية عند غياب أي حقل.
Output: MealAnalysisResult.
من يستدعيها؟ openai.ts و groq.ts.
-----------------------------------------
*/
export function normalizeOpenAIResult(json: Record<string, unknown>, provider: string): MealAnalysisResult {
  // قائمة الأطعمة إن كانت مصفوفة، مع تقريب الأرقام.
  // (x*10)/10 تحافظ على منزلة عشرية واحدة بعد التقريب.
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

  // المجاميع الكلية لكل مغذٍ (جمع عناصر القائمة مع تقريب).
  const totalCalories = Math.round(foods.reduce((a, f) => a + (f.calories ?? 0), 0));
  const totalProteinG = Math.round(foods.reduce((a, f) => a + (f.proteinG ?? 0), 0) * 10) / 10;
  const totalCarbsG = Math.round(foods.reduce((a, f) => a + (f.carbsG ?? 0), 0) * 10) / 10;
  const totalFatG = Math.round(foods.reduce((a, f) => a + (f.fatG ?? 0), 0) * 10) / 10;
  const totalFiberG = Math.round(foods.reduce((a, f) => a + (f.fiberG ?? 0), 0) * 10) / 10;
  const totalSodiumMg = Math.round(foods.reduce((a, f) => a + (f.sodiumMg ?? 0), 0));

  // النتيجة النهائية: تقديرية، تحتاج مراجعة، مع الاحتفاظ بالرد الخام.
  return {
    provider,
    isEstimate: true,
    confidence: Number(json.confidence ?? 70),
    foods,
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    totalFiberG,
    totalSodiumMg,
    needsReview: true,
    notes: typeof json.notes === 'string' ? json.notes : undefined,
    raw: json,
  };
}
