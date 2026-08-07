/**
 * مزود Gemini Vision — يُستدعى عند توفر GEMINI_API_KEY.
 */
import type { VisionProvider } from './types';
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

const PROMPT = `أنت خبير تغذية رياضية متخصص بقياس الحصص الغذائية من الصور بدقة عالية. حلل الوجبة في الصورة وقدّر المكونات.

المطلوب: إرجاع JSON خالص فقط (بدون أي نص آخر) بالصيغة التالية:
{"foods":[{"nameAr":"اسم الطعام بالعربية","nameEn":"اسم الطعام بالإنجليزية","grams":وزن تقريبي بالجرام,"calories":سعرات حرارية,"proteinG":بروتين,"carbsG":كربوهيدرات,"fatG":دهون,"fiberG":ألياف,"sodiumMg":صوديوم}],"confidence":درجة الثقة من 0 إلى 100,"notes":"ملاحظات غذائية قصيرة"}

قواعد الدقة:
1. قدّر حجم الحصة بالجرام مقارنة بأحجام قياسية (كف اليد، كوب، كرة التنس، طبق عشاء).
2. استخدم قيمًا غذائية علمية لكل 100 جرام من مكونات الوجبة الشائعة.
3. لا تختلق مكونات غير ظاهرة في الصورة.
4. اعتمد السعرات والمغذيات لكل طعام على الوزن المقدَّر للحصة الفعلية.
5. إن كانت الصورة ليست وجبة، أعد {"foods":[],"confidence":0,"notes":"الصورة لا تبدو وجبة طعام"}.`;

export function createGeminiProvider(): VisionProvider {
  return {
    name: 'gemini',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_VISION_MODEL ?? 'gemini-2.5-flash';
      if (!apiKey) throw new Error('GEMINI_API_KEY غير مضبوط في متغيرات البيئة');

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  { inline_data: { mime_type: imageDataUrl.split(',')[0].split(';')[0].replace('data:', ''), data: imageDataUrl.split(',')[1] } },
                ],
              },
            ],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`فشل استدعاء Gemini (${res.status})`);
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const json = JSON.parse(cleaned);

      return normalize(json, 'gemini');
    },
  };
}

function normalize(json: Record<string, unknown>, provider: string): MealAnalysisResult {
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
