/**
 * مزود OpenAI Vision — يُستدعى عند توفر OPENAI_API_KEY.
 * يرسل الصورة base64 مع تعليمات تحليل منظمة JSON.
 */
import type { VisionProvider } from './types';
import type { MealAnalysisResult, AnalyzedFood } from '@/types';

const SYSTEM_PROMPT = `أنت خبير تغذية رياضية يحلل صور وجبات السباحين. أعد إجابة JSON خالصة بدون أي نص آخر بالصيغة التالية:
{
  "foods": [
    { "nameAr": "اسم الطعام بالعربية", "nameEn": "english name", "grams": 150, "calories": 250, "proteinG": 20, "carbsG": 30, "fatG": 8, "fiberG": 3, "sodiumMg": 200 }
  ],
  "confidence": 75,
  "notes": "ملاحظات قصيرة عن الحصة والطهي"
}
قدر الأوزان والسعرات تقريبًا حسب حجم الحصة الظاهر. لاحظ أن الطهي والزيوت والصلصات تغير القيم.`;

export function createOpenAIProvider(): VisionProvider {
  return {
    name: 'openai',
    async analyze(imageDataUrl: string): Promise<MealAnalysisResult> {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini';
      if (!apiKey) throw new Error('OPENAI_API_KEY غير مضبوط في متغيرات البيئة');

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
        throw new Error(`فشل استدعاء OpenAI (${res.status})`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';
      const json = JSON.parse(content);

      return normalize(json, 'openai');
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

  const totalCalories = Math.round(foods.reduce((a, f) => a + (f.calories ?? 0), 0));
  const totalProteinG = Math.round(foods.reduce((a, f) => a + (f.proteinG ?? 0), 0) * 10) / 10;
  const totalCarbsG = Math.round(foods.reduce((a, f) => a + (f.carbsG ?? 0), 0) * 10) / 10;
  const totalFatG = Math.round(foods.reduce((a, f) => a + (f.fatG ?? 0), 0) * 10) / 10;
  const totalFiberG = Math.round(foods.reduce((a, f) => a + (f.fiberG ?? 0), 0) * 10) / 10;
  const totalSodiumMg = Math.round(foods.reduce((a, f) => a + (f.sodiumMg ?? 0), 0));

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
