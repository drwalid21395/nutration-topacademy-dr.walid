'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Trophy,
  Flame,
  Utensils,
  Salad,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

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

export default function CreatePlanPage() {
  const router = useRouter();
  const [planType, setPlanType] = useState('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ hasProfile: boolean; hasTargets: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/plan/status')
      .then((r) => r.json())
      .then(async (s) => {
        if (s.hasProfile && !s.hasTargets) {
          const res = await fetch('/api/calculator', { method: 'POST' });
          const data = await res.json();
          setReady({ hasProfile: true, hasTargets: res.ok || !!data.targetsId });
        } else {
          setReady(s);
        }
      })
      .catch(() => setReady({ hasProfile: false, hasTargets: false }));
  }, []);

  async function create() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر إنشاء الخطة');
      setLoading(false);
      return;
    }
    router.push(`/plan/${data.planId}?created=1`);
  }

  if (!ready) return <Spinner label="جارٍ التحقق من البيانات…" />;

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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">إنشاء الخطة الغذائية</h1>
        <p className="mt-1 text-sm text-slate-500">اختر مدة الخطة وسيُنشئ النظام خطة يومية متنوعة مع بدائل وقائمة مشتريات.</p>
      </div>

      {error && <div className="mb-4"><Alert variant="danger" title="خطأ">{error}</Alert></div>}

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

      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_OPTIONS.map((p) => (
          <button
            key={p.type}
            onClick={() => setPlanType(p.type)}
            className={cn(
              'relative rounded-2xl border-2 bg-white p-4 text-right transition-all hover:shadow-card-lg',
              planType === p.type ? 'border-ocean-500 shadow-card-lg' : 'border-slate-200'
            )}
          >
            {p.recommended && (
              <Badge color="gold" className="absolute -top-2 right-3">الأكثر استخدامًا</Badge>
            )}
            <p.icon className={cn('mb-2 h-7 w-7', planType === p.type ? 'text-ocean-600' : 'text-ocean-400')} />
            <p className="font-bold text-ocean-900">{p.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{p.desc}</p>
          </button>
        ))}
      </div>

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
