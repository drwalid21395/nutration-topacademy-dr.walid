/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/plan/plan-actions.tsx

وظيفة الملف:
أزرار إجراءات خطة غذائية:
1. طباعة (window.print).
2. مشاركة: يحاول مشاركة عبر النظام (navigator.share على
   الهاتف)، وإن لم يتوفر ينسخ الرابط، وإن فشل النسخ يعرض
   نافذة prompt.
3. إرسال بالبريد: رابط mailto مع العنوان والرابط.

لماذا نحتاجه؟
المستخدم (أو المدرب) يريد طباعة الخطة أو إرسالها
للسباح/ولي الأمر بسهولة.

'use client':
يعمل في المتصفح لأنه يستخدم navigator (مشاركة/نسخ)
وwindow.print.

متى يعمل؟
في صفحة عرض الخطة /plan/[id].

من يستدعي هذا الملف؟
src/app/plan/[id]/page.tsx.

الملفات التي يتعامل معها:
- لا API — كل شيء في المتصفح.
- lib/utils: cn (تغيير لون الزر عند النسخ).
- lucide-react: أيقونات.

ترتيب العمل:
1. نحسب رابط المشاركة الكامل (origin + المسار) ↓
2. زر الطباعة: يستدعي print مباشرة ↓
3. زر المشاركة: share → نسخ → prompt (ترتيب تنازلي حسب الدعم) ↓
4. زر البريد: mailto بعنوان الخطة ورابطها
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (حساب الرابط بعد العرض)، useState (حالة "تم النسخ").
import { useEffect, useState } from 'react';
// أيقونات: طابعة، مشاركة، صح (تم النسخ)، رابط.
import { Printer, Share2, Check, Link2 } from 'lucide-react';
// cn: دمج الفئات شرطيًا.
import { cn } from '@/lib/utils';

// ========================================
// 2. المكوّن الرئيسي: PlanActions
// ========================================

// PlanActions: أزرار طباعة ومشاركة وبريد.
// Props:
// - title: عنوان الخطة (يستخدم في نص المشاركة والبريد).
// - path: مسار الخطة (مثل /plan/abc) — نضيف إليه origin.
export function PlanActions({ title, path }: { title: string; path: string }) {
  // copied: هل نسخنا الرابط للتو؟ (يظهر "تم نسخ الرابط" لثانيتين).
  const [copied, setCopied] = useState(false);
  // shareUrl: الرابط الكامل الجاهز للمشاركة.
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // عند أول ظهور نحسب الرابط الكامل: أصل الموقع + مسار الخطة.
  useEffect(() => {
    setShareUrl(`${window.location.origin}${path}`);
  }, [path]);

  // share: مشاركة الخطة بترتيب من الأفضل للأبسط.
  async function share() {
    if (!shareUrl) return;
    // 1) على الهاتف/المتصفحات الحديثة: نافذة المشاركة النظامية.
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (err) {
        // إلغاء المستخدم للمشاركة ليس خطأ — نتوقف بصمت.
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError') return;
      }
    }
    // 2) بدون مشاركة نظامية: ننسخ الرابط إلى الحافظة.
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 3) فشل النسخ (متصفح قديم): نعرض النافذة يدويًا.
      window.prompt('انسخ الرابط:', shareUrl);
    }
  }

  return (
    <>
      {/* زر الطباعة: يعتمد على أمر الطباعة في المتصفح */}
      <button onClick={() => window.print()} className="btn-secondary">
        <Printer className="h-4 w-4" />
        طباعة
      </button>
      {/* زر المشاركة: يتغير لونه ونصه بعد النسخ */}
      <button
        onClick={share}
        className={cn('btn-secondary', copied && '!bg-emerald-600 !text-white')}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? 'تم نسخ الرابط' : 'مشاركة'}
      </button>
      {/* زر البريد: رابط mailto يفتح تطبيق البريد مع العنوان والرابط */}
      {shareUrl && (
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`}
          className="btn-secondary"
        >
          <Link2 className="h-4 w-4" />
          بريد
        </a>
      )}
    </>
  );
}
