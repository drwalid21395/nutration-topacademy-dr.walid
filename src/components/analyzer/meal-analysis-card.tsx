import { Camera, Sparkles, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatNumber } from '@/lib/utils';

/** عنصر غذائي داخل تحليل وجبة (foods JSON). */
export type MealFoodItem = {
  nameAr?: string;
  nameEn?: string;
  grams?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sodiumMg?: number;
};

/** تحويل نص foods (JSON) إلى مصفوفة عناصر، بأمان ضد الأخطاء. */
export function parseMealFoods(json: string | null): MealFoodItem[] {
  if (!json) return [];
  try {
    const data: unknown = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data as MealFoodItem[];
  } catch {
    return [];
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  mock: 'تقدير محلي',
  openai: 'OpenAI Vision',
  groq: 'Groq Vision',
  gemini: 'Gemini Vision',
};

/**
 * بطاقة تحليل وجبة أنيقة ومختصرة — تعرض مكونات الوجبة كبطاقات صغيرة
 * مع الإجماليات، وتناسب الجوال (تكدس عموديًا) والشاشات الكبيرة (شبكة).
 */
export function MealAnalysisCard({
  foods,
  photoUrl,
  provider,
  confidence,
  needsReview,
  totalCalories,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  totalFiberG,
  totalSodiumMg,
  notes,
  createdAt,
}: {
  foods: MealFoodItem[];
  photoUrl?: string | null;
  provider?: string | null;
  confidence?: number | null;
  needsReview?: boolean | null;
  totalCalories?: number | null;
  totalProteinG?: number | null;
  totalCarbsG?: number | null;
  totalFatG?: number | null;
  totalFiberG?: number | null;
  totalSodiumMg?: number | null;
  notes?: string | null;
  createdAt?: Date | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* الترويسة */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">
            <Camera className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-700">
              تحليل وجبة · {provider ? PROVIDER_LABEL[provider] ?? provider : 'تحليل'}
            </p>
            <p className="text-[10px] text-slate-400">
              {createdAt ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt) : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {confidence != null && <Badge color={confidence > 65 ? 'green' : 'gold'}>ثقة {Math.round(confidence)}٪</Badge>}
          {needsReview && <Badge color="gold">مراجعة</Badge>}
        </div>
      </div>

      <div className="p-3">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="الوجبة" className="mb-3 h-32 w-full rounded-xl object-cover" loading="lazy" />
        )}

        {foods.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {foods.map((f, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-800">{f.nameAr || f.nameEn || `مكوّن ${i + 1}`}</p>
                  {f.grams != null && <Badge color="slate">{formatNumber(f.grams)} جم</Badge>}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ['سعرات', f.calories],
                    ['بروتين', f.proteinG],
                    ['كربوهيدرات', f.carbsG],
                    ['دهون', f.fatG],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg bg-white px-1 py-1.5">
                      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                      <p className="text-xs font-black text-ocean-900">{formatNumber(Number(value ?? 0))}</p>
                    </div>
                  ))}
                </div>
                {(f.fiberG || f.sodiumMg) ? (
                  <p className="mt-1.5 text-[10px] text-slate-400" dir="auto">
                    ألياف {formatNumber(f.fiberG ?? 0, 1)} جم{f.sodiumMg ? ` · صوديوم ${formatNumber(f.sodiumMg)} مجم` : ''}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* الإجماليات */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-ocean-600 px-2.5 py-1 text-[11px] font-black text-white">
            <Sparkles className="h-3 w-3" />
            {formatNumber(totalCalories ?? 0)} سعرة
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            بروتين {formatNumber(totalProteinG ?? 0, 1)} جم
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            كربوهيدرات {formatNumber(totalCarbsG ?? 0, 1)} جم
          </span>
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
            دهون {formatNumber(totalFatG ?? 0, 1)} جم
          </span>
          {totalFiberG ? (
            <span className="rounded-full bg-lagoon-100 px-2.5 py-1 text-[11px] font-bold text-lagoon-600">
              ألياف {formatNumber(totalFiberG, 1)} جم
            </span>
          ) : null}
          {totalSodiumMg ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              صوديوم {formatNumber(totalSodiumMg)} مجم
            </span>
          ) : null}
        </div>

        {notes && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {notes}
          </p>
        )}
      </div>
    </div>
  );
}
