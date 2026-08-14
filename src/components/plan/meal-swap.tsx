/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/plan/meal-swap.tsx

وظيفة الملف:
زر "خطط بديلة (استبدال الوجبة)" داخل الوجبة في الخطة —
عند فتحه تظهر بدائل الوجبة من 4 أنواع:
1. اقتصادي
2. نباتي
3. خالٍ من اللاكتوز
4. خالٍ من الجلوتين
وعند الضغط "استبدال" يطلب النظام (AI) تبديل الوجبة
بالبديل ثم يعيد تحميل الصفحة لعرض الوجبة الجديدة.

لماذا نحتاجه؟
السباح قد لا تتوفر لديه مكونات الوجبة الأصلية أو يفضّل
بديلًا صحيًا — فيستبدلها دون تغيير بقية الخطة.

'use client':
يعمل في المتصفح لأنه يستخدم useState (فتح القائمة) وfetch.

متى يعمل؟
داخل كل وجبة في صفحة عرض الخطة /plan/[id].

من يستدعي هذا الملف؟
src/app/plan/[id]/page.tsx.

الملفات التي يتعامل معها:
- API: /api/plan/[planId]/meal/[mealId] (POST لطلب البديل).
- lib/utils: cn.
- lucide-react: أيقونات تحديث وسهم.

ترتيب العمل:
1. نضغط "خطط بديلة" → تنفتح قائمة الأنواع الأربعة ↓
2. نضغط "استبدال" لنوع → POST للخادم بنوع البديل ↓
3. نجاح → رسالة "تم الاستبدال" ثم إعادة تحميل الصفحة ↓
4. فشل → رسالة الخطأ
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useState: حالة متغيرة (فتح القائمة، الجاري، الخطأ، تم).
import { useState } from 'react';
// أيقونات: تحديث دوّار وسهم للفتح.
import { RefreshCw, ChevronDown } from 'lucide-react';
// cn: دمج الفئات شرطيًا.
import { cn } from '@/lib/utils';

// ========================================
// 2. بيانات ثابتة
// ========================================

// ALTERNATIVE_TYPES: أنواع البدائل الأربعة المتاحة.
const ALTERNATIVE_TYPES: { type: string; label: string }[] = [
  { type: 'economical', label: 'بديل اقتصادي' },
  { type: 'vegetarian', label: 'بديل نباتي' },
  { type: 'lactoseFree', label: 'بديل خالٍ من اللاكتوز' },
  { type: 'glutenFree', label: 'بديل خالٍ من الجلوتين' },
];

// StoredAlternative: شكل البديل المحفوظ مسبقًا في قاعدة البيانات
// (عرض نختصره أسفل اسم البديل).
export interface StoredAlternative {
  type: string;
  items: { foodNameAr: string; quantity: string | null }[];
}

// ========================================
// 3. المكوّن الرئيسي: MealSwap
// ========================================

// MealSwap: استبدال وجبة.
// Props:
// - mealId: معرف الوجبة المراد استبدالها.
// - planId: معرف الخطة التي تنتمي إليها الوجبة.
// - alternatives: البدائل المحفوظة سابقًا لعرضها (إن وُجدت).
export function MealSwap({
  mealId,
  planId,
  alternatives,
}: {
  mealId: string;
  planId: string;
  alternatives: StoredAlternative[];
}) {
  // open: هل القائمة المنسدلة مفتوحة؟
  const [open, setOpen] = useState(false);
  // busy: أي نوع جارٍ استبداله حاليًا (يعطّل بقية الأزرار).
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // done: أي نوع تم استبداله للتو (يعرض "تم الاستبدال").
  const [done, setDone] = useState<string | null>(null);

  // swap: طلب استبدال الوجبة بنوع بديل محدد.
  async function swap(altType: string) {
    setBusy(altType);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/plan/${planId}/meal/${mealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alternativeType: altType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'تعذر الاستبدال');
        return;
      }
      // نجاح: نعرض "تم الاستبدال" لثوانٍ ثم نعيد تحميل الصفحة
      // لعرض الوجبة البديلة الجديدة.
      setDone(altType);
      setTimeout(() => setDone(null), 2500);
      window.location.reload();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  // stored: خريطة النوع ← عناصر البديل (للبحث السريع).
  // (Map يجعل جلب العناصر O(1) بدل البحث المتكرر).
  const stored = new Map(alternatives.map((a) => [a.type, a.items]));

  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
      {/* رأس القسم: زر يفتح/يغلق القائمة */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-bold text-ocean-700 hover:text-ocean-900"
      >
        <span>خطط بديلة (استبدال الوجبة)</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {error && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
          {/* map: صف لكل نوع بديل */}
          {ALTERNATIVE_TYPES.map(({ type, label }) => {
            const items = stored.get(type);
            const isDone = done === type;
            return (
              <div
                key={type}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700">{label}</p>
                  {/* إن كان لدينا بديل محفوظ نعرض مكوناته كسطر مختصر */}
                  {items && items.length > 0 && (
                    <p className="truncate text-[11px] text-slate-400">
                      {items.map((it) => it.foodNameAr).join('، ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => swap(type)}
                  disabled={busy !== null}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-ocean-50 text-ocean-700 ring-1 ring-ocean-200 hover:bg-ocean-600 hover:text-white'
                  )}
                >
                  {/* نص الزر حسب الحالة: دوران ← تم ← استبدال */}
                  {busy === type ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : isDone ? (
                    'تم الاستبدال'
                  ) : (
                    'استبدال'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
