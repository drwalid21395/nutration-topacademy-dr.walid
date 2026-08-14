/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/ai/groq.ts

وظيفة الملف:
"مزود Groq لتحليل صور الوجبات" — يرسل الصورة إلى خدمة Groq
التي توفر واجهة متوافقة مع OpenAI (صيغة رسائل messages) وبنموذج
Llama Vision، ثم يحوّل الرد إلى نتيجة موحدة.

لماذا نحتاجه؟
يوفّر بديلًا يعمل بدون قيود جغرافية عند توفر GROQ_API_KEY،
ويمنح الموقع أكثر من خيار في تحليل الصور.

متى يعمل؟
عند طلب "تحليل بالصورة" مع ضبط GROQ_API_KEY في متغيرات البيئة.

من يستدعي هذا الملف؟
كود اختيار المزود في services/ai — عبر createGroqProvider.

الملفات التي يتعامل معها:
- ./types → VisionProvider.
- @/types → MealAnalysisResult.
- ./openai → extractJson و normalizeOpenAIResult (إعادة استخدام).

ترتيب العمل:
رفع صورة الوجبة ↓
إرسالها بصيغة OpenAI إلى api.groq.com ↓
استخراج نص الرد ↓
تنظيف النص (extractJson) وتوحيده (normalizeOpenAIResult)

ملاحظة مهمة:
هذه طبقة "منطق أعمال" — تتصل بخدمة خارجية عبر fetch وتعيد
نتيجة موحدة دون عرض واجهة أو إرسال طلبات من المتصفح.
==================================================
*/

/**
 * مزود Groq Vision — يُستدعى عند توفر GROQ_API_KEY.
 * Groq يوفر واجهة متوافقة مع OpenAI وتعمل بدون قيود جغرافية،
 * ويستخدم نموذج Llama Vision لتحليل صور الوجبات.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// VisionProvider: الواجهة الموحدة لكل المزودات (ملف محلي).
import type { VisionProvider } from './types';
// MealAnalysisResult: شكل النتيجة النهائية (من @/types).
import type { MealAnalysisResult } from '@/types';
// extractJson: استخراج JSON من نص الرد رغم أي كلام حوله.
// normalizeOpenAIResult: تحويل الكائن الخام إلى نتيجة موحدة.
// كلتاهما من ملف openai.ts في نفس المجلد.
import { extractJson, normalizeOpenAIResult } from './openai';

// ========================================
// 2. التعليمات (SYSTEM_PROMPT) المرسلة للنموذج
// ========================================

// نفس أسلوب Gemini: تعليمات عربية تطلب JSON خالصًا فقط،
// لنتمكن من تحويله برمجيًا بشكل مباشر.
const SYSTEM_PROMPT = `أنت خبير تغذية رياضية متخصص بقياس الحصص الغذائية من الصور بدقة عالية. حلل الوجبة في الصورة وقدّر المكونات.

المطلوب: إرجاع JSON خالص فقط (بدون أي نص آخر) بالصيغة التالية:
{"foods":[{"nameAr":"اسم الطعام بالعربية","nameEn":"اسم الطعام بالإنجليزية","grams":وزن تقريبي بالجرام,"calories":سعرات حرارية,"proteinG":بروتين,"carbsG":كربوهيدرات,"fatG":دهون,"fiberG":ألياف,"sodiumMg":صوديوم}],"confidence":درجة الثقة من 0 إلى 100,"notes":"ملاحظات غذائية قصيرة"}

قواعد الدقة:
1. قدّر حجم الحصة بالجرام مقارنة بأحجام قياسية (كف اليد، كوب، كرة التنس، طبق عشاء).
2. استخدم قيمًا غذائية علمية لكل 100 جرام من مكونات الوجبة الشائعة.
3. لا تختلق مكونات غير ظاهرة في الصورة.
4. اعتمد السعرات والمغذيات لكل طعام على الوزن المقدَّر للحصة الفعلية.
5. إن كانت الصورة ليست وجبة، أعد {"foods":[],"confidence":0,"notes":"الصورة لا تبدو وجبة طعام"}.`;

// ========================================
// 3. الدالة الرئيسية: إنشاء مزود Groq
// ========================================

/*
-----------------------------------------
الدالة: createGroqProvider
-----------------------------------------
وظيفتها: تُرجع مزودًا جاهزًا يتوافق مع واجهة VisionProvider.
Input: بلا مدخلات.
Processing:
  1. قراءة GROQ_API_KEY والنموذج من متغيرات البيئة.
  2. إرسال الصورة مع التعليمات بصيغة OpenAI إلى api.groq.com.
  3. استخراج نص الرد ثم extractJson ثم normalizeOpenAIResult.
Output: VisionProvider.
من يستدعيها؟ كود اختيار المزود عند توفر مفتاح Groq.
ماذا تستدعي هي؟ خدمة Groq + extractJson + normalizeOpenAIResult.
-----------------------------------------
*/
export function createGroqProvider(): VisionProvider {
  return {
    name: 'groq',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      // المفتاح والنموذج من متغيرات البيئة (لا تُرفع للمتجر أبدًا).
      const apiKey = process.env.GROQ_API_KEY;
      const model = process.env.GROQ_VISION_MODEL ?? 'qwen/qwen3.6-27b';
      // بدون مفتاح لا نستطيع التحليل الحقيقي فنرفض بوضوح.
      if (!apiKey) throw new Error('GROQ_API_KEY غير مضبوط في متغيرات البيئة');

      // طلب POST بصيغة chat/completions (متوافقة مع OpenAI).
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1500,
          reasoning_effort: 'none',
          messages: [
            // رسالة نظام = دور النموذج، ورسالة مستخدم = التعليمات + الصورة.
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

      // فشل الاتصال → خطأ واضح يتضمن أول 200 حرف من الرد للمساعدة.
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`فشل استدعاء Groq (${res.status}): ${err.slice(0, 200)}`);
      }

      // الوصول لنص الرد داخل بنية choices ← message ← content.
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      // تنظيف النص واستخراج JSON ثم توحيده بنفس دوال OpenAI.
      return normalizeOpenAIResult(extractJson(content), 'groq');
    },
  };
}
