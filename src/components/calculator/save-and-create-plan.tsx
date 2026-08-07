'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Salad } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SaveAndCreatePlan() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function saveThenCreate() {
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/calculator', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setState('error');
        setError(data.error ?? 'تعذر حفظ الاحتياجات');
        return;
      }
      setState('saved');
      router.push('/plan/create');
    } catch {
      setState('error');
      setError('تعذر الاتصال بالخادم');
    }
  }

  return (
    <div>
      <button
        onClick={saveThenCreate}
        disabled={state === 'saving'}
        className={cn(
          'btn-gold mt-4 w-full',
          state === 'saving' && 'opacity-70',
          state === 'saved' && 'bg-emerald-600 hover:bg-emerald-700'
        )}
      >
        {state === 'saving' && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        )}
        {state === 'saved' ? <CheckCircle2 className="h-5 w-5" /> : <Salad className="h-5 w-5" />}
        {state === 'saving' ? 'جارٍ حفظ الاحتياجات…' : state === 'saved' ? 'تم الحفظ — جارٍ الانتقال…' : 'حفظ الاحتياجات وإنشاء الخطة'}
      </button>
      {state === 'error' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
