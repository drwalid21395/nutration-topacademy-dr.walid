/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/plan/create/page.tsx

وظيفة الملف:
صفحة "إنشاء الخطة الغذائية" (المسار /plan/create).
يختار المستخدم مدة الخطة (يوم، 3 أيام، أسبوع، أسبوعين،
30 يومًا، استعداد البطولة...) ثم يضغط "توليد الخطة الآن"
فتُرسل واجهة API تنشئ الخطة وتنقله لصفحتها.

لماذا نحتاجه؟
هذه هي نقطة دخول إنشاء الخطط — بدونها لا يمكن للمستخدم
توليد أي خطة غذائية.

نوعها: Client Component ('use client').
تعمل في المتصفح لأنها تستخدم useState/useEffect و fetch
وأحداث الضغط — أشياء لا تعمل في الخادم.

متى يعمل؟
عند فتح /plan/create بعد تسجيل الدخول.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ يصل إليه المستخدم من زر
"إنشاء خطة" في لوحة التحكم وصفحة الخطط.

الملفات التي يتعامل معها:
- واجهات API: /api/plan/status (فحص جاهزية البيانات)،
  /api/calculator (حساب الاحتياجات لو فات)، /api/plan (الإنشاء).
- مكونات UI (Button, Alert, Card, Badge, Spinner, EmptyState).
- cn من lib/utils.

ترتيب العمل:
1. عند فتح الصفحة: نفحص جاهزية البيانات (ملف سباح + احتياجات).
2. لو لا يوجد ملف → نطلب إدخاله أولًا.
3. لو ملف بلا احتياجات → نحاول حسابه تلقائيًا.
4. يختار المستخدم المدة ثم يضغط توليد → POST إلى /api/plan.
5. النجاح → انتقال لصفحة الخطة مع ?created=1.
==================================================
*/

// ========================================
// 1. التوجيه
// ========================================

'use client';

// ========================================
// 2. الاستيرادات
// ========================================

import { useState, useEffect } from 'react'; // useState: حفظ الحالة. useEffect: تنفيذ أمر عند فتح الصفحة — من مكتبة react.
import { useRouter } from 'next/navigation'; // useRouter: أداة التنقل البرمجي بين الصفحات — من مكتبة next/navigation.
import {
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Trophy,
  Flame,
  Utensils,
  Salad,
  AlertTriangle,
} from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية.
import { Button } from '@/components/ui/button'; // زر جاهز — ملف محلي.
import { Alert, Card, Badge, Spinner, EmptyState } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.

// ملاحظة:
// يبدو أن المكوّن Card مستورد هنا لكنه غير مستخدم حاليًا في هذا الملف.
// يجب التأكد قبل حذفه.
import { cn } from '@/lib/utils'; // دالة دمج أسماء الفئات (Tailwind) — ملف محلي.

// ========================================
// 3. الثوابت (أنواع الخطط المتاحة)
// ========================================

// PLAN_OPTIONS: مصفوفة (Array) خيارات مدة الخطة.
// كل كائن فيه: نوع الخطة، اسمها، أيقونتها، ووصفها.
// recommended: بعضها يظهر عليه شارة "الأكثر استخدامًا".
const PLAN_OPTIONS = [
  { type: 'daily', label: 'خطة يوم واحد', icon: CalendarDays, desc: 'نموذج سريع ليوم كامل' },
  { type: 'threeDays', label: 'خطة 3 أيام', icon: CalendarRange, desc: 'متنوعة لثلاثة أيام' },
  { type: 'week', label: 'خطة أسبوع', icon: CalendarCheck, desc: 'الأكثر شيوعًا — 7 أيام متنوعة', recommended: true },
  { type: 'twoWeeks', label: 'خطة أسبوعين', icon: CalendarRange, desc: '14 يومًا بتنوع أوسع' },
  { type: 'thirtyDays', label: 'خطة 30 يومًا', icon: CalendarRange, desc: 'شهر كامل من الوجبات' },
  { type: 'competitionPrep', label: 'استعداد للبطولة', icon: Trophy, desc: 'الأسبوع السابق للبطولة' },
  { type: 'competitionDay', label: 'يوم البطولة', icon: Trophy, desc: 'خطة خاصة ليوم السباقات' },
  { type: 'postCompetition', label: 'استشفاء بعد البطولة', icon: Utensils, desc: '3 أيام لاستعادة الجهد' },
];

// ========================================
// 4. الصفحة الرئيسية (تعمل في المتصفح)
// ========================================

// CreatePlanPage: الصفحة الرئيسية (Client).
export default function CreatePlanPage() {
  const router = useRouter(); // أداة التنقل بين الصفحات.
  // حالات الصفحة:
  const [planType, setPlanType] = useState('week'); // النوع المختار (الافتراضي: خطة أسبوع).
  const [loading, setLoading] = useState(false); // هل الإنشاء جارٍ الآن؟
  const [error, setError] = useState<string | null>(null); // رسالة الخطأ (أو null).
  const [ready, setReady] = useState<{ hasProfile: boolean; hasTargets: boolean } | null>(null); // حالة الجاهزية (null = لم يُفحص بعد).

  // useEffect: ينفذ مرة واحدة عند فتح الصفحة (المصفوفة الفارغة [] تعني مرة واحدة).
  // نفحص هل أدخل المستخدم ملفه وحسب احتياجاته.
  useEffect(() => {
    fetch('/api/plan/status') // نسأل واجهة API عن حالة الجاهزية.
      .then((r) => r.json()) // نحول الرد إلى كائن.
      .then(async (s) => {
        // لو لديه ملف لكن لا توجد احتياجات محسوبة:
        // نطلب الحساب تلقائيًا عبر /api/calculator (POST).
        if (s.hasProfile && !s.hasTargets) {
          const res = await fetch('/api/calculator', { method: 'POST' });
          const data = await res.json();
          // hasTargets صحيح لو نجح الحساب (res.ok) أو أعاد معرّف هدف.
          setReady({ hasProfile: true, hasTargets: res.ok || !!data.targetsId });
        } else {
          // وإلا نحفظ حالة الجاهزية كما وصلت من الخادم.
          setReady(s);
        }
      })
      // لو فشل الاتصال: نفترض لا ملف ولا احتياجات (لتظهر رسالة الإدخال).
      .catch(() => setReady({ hasProfile: false, hasTargets: false }));
  }, []);

  // create: دالة تُستدعى عند الضغط على "توليد الخطة الآن".
  async function create() {
    setLoading(true); // نبدأ التحميل.
    setError(null); // نمسح أي خطأ سابق.
    // نرسل النوع المختار لواجهة API التي تنشئ الخطة.
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType }),
    });
    const data = await res.json(); // نقرأ رد الخادم.
    if (!res.ok) {
      // لو فشل: نعرض رسالة الخطأ ونتوقف.
      setError(data.error ?? 'تعذر إنشاء الخطة');
      setLoading(false);
      return;
    }
    // النجاح: ننقل المستخدم لصفحة الخطة الجديدة مع علامة ?created=1
    // (تُظهر رسالة نجاح داخل صفحة الخطة).
    router.push(`/plan/${data.planId}?created=1`);
  }

  // بينما لم ننتهِ من الفحص بعد (ready = null) → شاشة تحميل.
  if (!ready) return <Spinner label="جارٍ التحقق من البيانات…" />;

  // لو لا يوجد ملف سباح → نطلب إدخاله أولًا مع زر انتقال.
  if (!ready.hasProfile) {
    return (
      <EmptyState
        icon={<Salad className="h-12 w-12" />}
        title="أدخل بيانات السباح أولًا"
        description="لإنشاء خطة دقيقة، أدخل ملف السباح واحسب الاحتياجات أولًا."
        action={<Button onClick={() => router.push('/swimmer-profile')}>إدخال بيانات السباح</Button>}
      />
    );
  }

  // ========================================
  // 5. عرض الواجهة (JSX)
  // ========================================
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">إنشاء الخطة الغذائية</h1>
        <p className="mt-1 text-sm text-slate-500">اختر مدة الخطة وسيُنشئ النظام خطة يومية متنوعة مع بدائل وقائمة مشتريات.</p>
      </div>

      {/* رسالة الخطأ (إن وجدت) */}
      {error && <div className="mb-4"><Alert variant="danger" title="خطأ">{error}</Alert></div>}

      {/* تحذير: لا توجد احتياجات محسوبة (الحساب التلقائي لم ينجح). */}
      {!ready.hasTargets && (
        <div className="mb-4">
          <Alert variant="warning" title="تعذر حفظ الاحتياجات تلقائيًا">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              لم تُحفظ احتياجات محسوبة حتى الآن. احسب الاحتياجات من حاسبة الاحتياجات أولًا، أو تأكد من اكتمال بيانات السباح (الطول والوزن والعمر).
            </div>
          </Alert>
        </div>
      )}

      {/* شبكة خيارات مدة الخطة: map على PLAN_OPTIONS.
          كل خيار زر button ينقر لاختياره (setPlanType). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_OPTIONS.map((p) => (
          <button
            key={p.type}
            onClick={() => setPlanType(p.type)}
            className={cn(
              // تنسيق عام، ولو الخيار مختار نلوّن إطاره بالأزرق.
              'relative rounded-2xl border-2 bg-white p-4 text-right transition-all hover:shadow-card-lg',
              planType === p.type ? 'border-ocean-500 shadow-card-lg' : 'border-slate-200'
            )}
          >
            {/* شارة "الأكثر استخدامًا" للخيار المميز (recommended). */}
            {p.recommended && (
              <Badge color="gold" className="absolute -top-2 right-3">الأكثر استخدامًا</Badge>
            )}
            {/* الأيقونة بلون مميز لو الخيار مختار. */}
            <p.icon className={cn('mb-2 h-7 w-7', planType === p.type ? 'text-ocean-600' : 'text-ocean-400')} />
            <p className="font-bold text-ocean-900">{p.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{p.desc}</p>
          </button>
        ))}
      </div>

      {/* زر التوليد الرئيسي: يستدعي create؛ loading يعرض دورانًا ويمنع التكرار. */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={create} loading={loading} className="!px-8 !py-3.5 !text-base">
          <Flame className="h-5 w-5" />
          توليد الخطة الآن
        </Button>
        <p className="text-xs text-slate-500">سعرات ومغذيات مأخوذة من آخر حساب احتياجات محفوظ.</p>
      </div>
    </div>
  );
}
