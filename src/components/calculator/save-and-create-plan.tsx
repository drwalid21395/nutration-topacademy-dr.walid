/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/calculator/save-and-create-plan.tsx

وظيفة الملف:
زر "حفظ الاحتياجات وإنشاء الخطة" في صفحة الحاسبة.
عند الضغط عليه:
1. يحفظ الاحتياجات الغذائية المحسوبة في قاعدة البيانات
   (طلب POST إلى /api/calculator).
2. عند النجاح ينقل المستخدم إلى صفحة إنشاء الخطة /plan/create.
يعرض حالات مختلفة للزر: جارٍ الحفظ، تم الحفظ، أو خطأ.

لماذا نحتاجه؟
بعد أن يحسب المستخدم احتياجاته، يريد حفظها ثم الانتقال
مباشرة لإنشاء خطة غذائية — بدل خطوتين منفصلتين.

'use client':
يعمل في المتصفح لأنه يستخدم useState وuseRouter وfetch.

متى يعمل؟
في صفحة حاسبة الاحتياجات /calculator.

من يستدعي هذا الملف؟
src/app/calculator/page.tsx.

الملفات التي يتعامل معها:
- API: /api/calculator (حفظ الاحتياجات).
- useRouter من next/navigation (الانتقال لصفحة إنشاء الخطة).
- cn من lib/utils (دمج فئات Tailwind).
- lucide-react: أيقونات (صح، سلطة).

ترتيب العمل:
1. المستخدم يضغط الزر ↓
2. saveThenCreate تبدأ ↓
3. fetch POST إلى /api/calculator ↓
4. نجاح؟ → حالة saved ثم router.push('/plan/create') ↓
5. فشل؟ → نعرض رسالة الخطأ أسفل الزر
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useState: حفظ حالة متغيرة (idle/saving/saved/error).
import { useState } from 'react';
// useRouter: التنقل بين الصفحات برمجيًا من next/navigation.
import { useRouter } from 'next/navigation';
// أيقونات من lucide-react: صح (نجاح) وسلطة (إنشاء خطة).
import { CheckCircle2, Salad } from 'lucide-react';
// cn: دالة مساعدة لدمج فئات Tailwind حسب الشرط.
import { cn } from '@/lib/utils';

// ========================================
// 2. المكوّن الرئيسي: SaveAndCreatePlan
// ========================================

export function SaveAndCreatePlan() {
  const router = useRouter();
  // state: مراحل الزر — idle (جاهز)، saving (جارٍ)، saved (تم)، error (خطأ).
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // error: نص الخطأ ليعرضه للمستخدم.
  const [error, setError] = useState<string | null>(null);

  // saveThenCreate: حفظ الاحتياجات ثم الانتقال لإنشاء الخطة.
  async function saveThenCreate() {
    setState('saving');
    setError(null);
    try {
      // fetch POST إلى /api/calculator بدون بيانات إضافية
      // (الخادم يعرف المستخدم من الجلسة ويحفظ آخر حساب له).
      const res = await fetch('/api/calculator', { method: 'POST' });
      const data = await res.json();
      // لو الخادم رد بخطأ → نعرضه ونرجع للحالة idle.
      if (!res.ok) {
        setState('error');
        setError(data.error ?? 'تعذر حفظ الاحتياجات');
        return;
      }
      // النجاح: نحفظ الحالة ثم ننتقل لصفحة إنشاء الخطة.
      setState('saved');
      router.push('/plan/create');
    } catch {
      // خطأ في الاتصال بالشبكة نفسها.
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
          // أثناء الحفظ نخفف اللون (opacity-70) ولو نجحنا نجعله أخضر.
          state === 'saving' && 'opacity-70',
          state === 'saved' && 'bg-emerald-600 hover:bg-emerald-700'
        )}
      >
        {/* أيقونة دوّارة أثناء الحفظ (svg مع animate-spin) */}
        {state === 'saving' && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        )}
        {/* الأيقونة الرئيسية حسب الحالة */}
        {state === 'saved' ? <CheckCircle2 className="h-5 w-5" /> : <Salad className="h-5 w-5" />}
        {/* نص الزر يتغير حسب الحالة (عامل ثلاثي ? :) */}
        {state === 'saving' ? 'جارٍ حفظ الاحتياجات…' : state === 'saved' ? 'تم الحفظ — جارٍ الانتقال…' : 'حفظ الاحتياجات وإنشاء الخطة'}
      </button>
      {/* رسالة الخطأ تظهر فقط عند حدوثه */}
      {state === 'error' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
