/**
 * مزود Groq Vision — يُستدعى عند توفر GROQ_API_KEY.
 * Groq يوفر واجهة متوافقة مع OpenAI وتعمل بدون قيود جغرافية،
 * ويستخدم نموذج Llama Vision لتحليل صور الوجبات.
 */
import type { VisionProvider } from './types';
import type { MealAnalysisResult } from '@/types';
import { extractJson, normalizeOpenAIResult } from './openai';

const SYSTEM_PROMPT = `أنت خبير تغذية رياضية متخصص بقياس الحصص الغذائية من الصور بدقة عالية. حلل الوجبة في الصورة وقدّر المكونات.

المطلوب: إرجاع JSON خالص فقط (بدون أي نص آخر) بالصيغة التالية:
{"foods":[{"nameAr":"اسم الطعام بالعربية","nameEn":"اسم الطعام بالإنجليزية","grams":وزن تقريبي بالجرام,"calories":سعرات حرارية,"proteinG":بروتين,"carbsG":كربوهيدرات,"fatG":دهون,"fiberG":ألياف,"sodiumMg":صوديوم}],"confidence":درجة الثقة من 0 إلى 100,"notes":"ملاحظات غذائية قصيرة"}

قواعد الدقة:
1. قدّر حجم الحصة بالجرام مقارنة بأحجام قياسية (كف اليد، كوب، كرة التنس، طبق عشاء).
2. استخدم قيمًا غذائية علمية لكل 100 جرام من مكونات الوجبة الشائعة.
3. لا تختلق مكونات غير ظاهرة في الصورة.
4. اعتمد السعرات والمغذيات لكل طعام على الوزن المقدَّر للحصة الفعلية.
5. إن كانت الصورة ليست وجبة، أعد {"foods":[],"confidence":0,"notes":"الصورة لا تبدو وجبة طعام"}.`;

export function createGroqProvider(): VisionProvider {
  return {
    name: 'groq',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      const apiKey = process.env.GROQ_API_KEY;
      const model = process.env.GROQ_VISION_MODEL ?? 'qwen/qwen3.6-27b';
      if (!apiKey) throw new Error('GROQ_API_KEY غير مضبوط في متغيرات البيئة');

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

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`فشل استدعاء Groq (${res.status}): ${err.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';

      return normalizeOpenAIResult(extractJson(content), 'groq');
    },
  };
}
