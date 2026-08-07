'use client';

import { useState } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALTERNATIVE_TYPES: { type: string; label: string }[] = [
  { type: 'economical', label: 'بديل اقتصادي' },
  { type: 'vegetarian', label: 'بديل نباتي' },
  { type: 'lactoseFree', label: 'بديل خالٍ من اللاكتوز' },
  { type: 'glutenFree', label: 'بديل خالٍ من الجلوتين' },
];

export interface StoredAlternative {
  type: string;
  items: { foodNameAr: string; quantity: string | null }[];
}

export function MealSwap({
  mealId,
  planId,
  alternatives,
}: {
  mealId: string;
  planId: string;
  alternatives: StoredAlternative[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
      setDone(altType);
      setTimeout(() => setDone(null), 2500);
      window.location.reload();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy(null);
    }
  }

  const stored = new Map(alternatives.map((a) => [a.type, a.items]));

  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
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
