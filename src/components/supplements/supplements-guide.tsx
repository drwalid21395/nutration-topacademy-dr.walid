'use client';

import { useEffect, useState } from 'react';
import { Pill, ShieldAlert, CheckCircle2, FlaskConical, Stethoscope, Leaf, Ban } from 'lucide-react';
import { Card, Badge, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { MEDICAL_DISCLAIMER } from '@/lib/constants';

export function SupplementsGuide({ isMinor }: { isMinor: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acked, setAcked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/supplements')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.supplements ?? []);
        setAcked(new Set(d.ackedIds ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAck(id: string) {
    const wasAcked = acked.has(id);
    const res = await fetch(
      wasAcked ? `/api/supplements?supplementId=${encodeURIComponent(id)}` : '/api/supplements',
      {
        method: wasAcked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: wasAcked ? undefined : JSON.stringify({ supplementId: id, ack: true }),
      }
    );
    if (!res.ok) return;
    setAcked((s) => {
      const next = new Set(s);
      if (wasAcked) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">دليل المكملات الغذائية</h1>
        <p className="mt-1 text-sm text-slate-500">
          معلومات تثقيفية عامة عن المكملات الشائعة في رياضة السباحة. لا يقدّم النظام توصيات بجرعات ولا بديلًا عن الطبيب.
        </p>
      </div>

      <div className="mb-5">
        <Alert variant="warning" title="تنبيه مهم">{MEDICAL_DISCLAIMER}</Alert>
      </div>

      {isMinor && (
        <div className="mb-5">
          <Alert variant="danger" title="لفئة القاصرين">
            المكملات الغذائية للرياضيين دون 18 عامًا تتطلب إشرافًا طبيًا صارمًا. بعض المنتجات محظورة على القاصرين لأسباب صحية وقانونية، ولا يُنصح بها إلا بعد فحص ووصف من الطبيب وموافقة ولي الأمر.
          </Alert>
        </div>
      )}

      {loading ? (
        <Card><p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p></Card>
      ) : items.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-slate-400">لا توجد بيانات.</p></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {items.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-300/30 text-gold-600">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ocean-900">{s.nameAr}</h3>
                    {s.nameEn && <p className="text-xs text-slate-400" dir="ltr">{s.nameEn}</p>}
                  </div>
                </div>
                {s.category && <Badge color="slate">{s.category}</Badge>}
              </div>

              {s.descriptionAr && <p className="mb-3 text-sm leading-relaxed text-slate-600">{s.descriptionAr}</p>}

              <div className="mb-3 space-y-2 text-sm">
                {s.functionAr && (
                  <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span><b>وظيفته المحتملة:</b> {s.functionAr}</span></p>
                )}
                {s.consideredCasesAr && (
                  <p className="flex items-start gap-2"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-ocean-500" /><span><b>متى يُنظر فيه:</b> {s.consideredCasesAr}</span></p>
                )}
                {s.naturalAlternativesAr && (
                  <p className="flex items-start gap-2"><Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span><b>بدائل طبيعية:</b> {s.naturalAlternativesAr}</span></p>
                )}
                {s.avoidGroupsAr && (
                  <p className="flex items-start gap-2"><Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /><span><b>فئات تتجنبه:</b> {s.avoidGroupsAr}</span></p>
                )}
              </div>

              {(s.sideEffectsAr || s.interactionsAr || s.needsLabTest || s.needsMedicalSupervision) && (
                <div className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                  {s.sideEffectsAr && <p className="text-slate-600"><b>أعراض جانبية:</b> {s.sideEffectsAr}</p>}
                  {s.interactionsAr && <p className="text-slate-600"><b>تداخلات:</b> {s.interactionsAr}</p>}
                  {(s.needsLabTest || s.needsMedicalSupervision) && (
                    <p className="flex items-center gap-1.5 text-amber-700">
                      <Stethoscope className="h-4 w-4" />
                      يتطلب {s.needsLabTest ? 'تحليلًا مخبريًا ' : ''}{s.needsLabTest && s.needsMedicalSupervision ? 'و' : ''}{s.needsMedicalSupervision ? 'إشرافًا طبيًا' : ''} قبل الاستخدام.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                {s.isProhibitedRisk ? (
                  <Badge color="red">
                    <ShieldAlert className="ml-1 h-3 w-3" />
                    خطر محتمل من المنشطات — تجنّبه
                  </Badge>
                ) : (
                  <Badge color="green">آمن نسبيًا بالجرعات الصحيحة</Badge>
                )}
                {acked.has(s.id) ? (
                  <button
                    type="button"
                    onClick={() => toggleAck(s.id)}
                    className="btn-secondary !py-1.5 !text-xs"
                    title="اضغط لإلغاء الإقرار"
                  >
                    تم الإقرار بالاستشارة ✓ — إلغاء الإقرار
                  </button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => toggleAck(s.id)}>
                    أقرّ بالاستشارة الطبية أولًا
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
