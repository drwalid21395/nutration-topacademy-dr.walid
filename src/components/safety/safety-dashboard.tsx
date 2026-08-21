'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  HeartPulse,
  Activity,
  Thermometer,
  Wind,
  Brain,
  Footprints,
  Watch,
  Battery,
  MapPin,
  CheckCircle2,
  Send,
  XCircle,
} from 'lucide-react';
import { Card, Badge, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/app-shell';
import type { SessionUser } from '@/lib/auth';
import { RISK_LABELS } from '@/lib/safety/types';

interface SafetyStatus {
  latestVitals: Record<string, unknown> | null;
  activeAlertsCount: number;
  activeAlerts: Array<{
    id: string;
    level: string;
    title: string;
    message: string;
    heartRate: number | null;
    spo2: number | null;
    riskScore: number;
    createdAt: string;
  }>;
  lastUpdateAgo: string;
  watchConnected: boolean;
  batteryLevel: number | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    description: string | null;
    createdAt: string;
  }>;
}

export function SafetyDashboard({ user }: { user: SessionUser }) {
  const [status, setStatus] = useState<SafetyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [hr, setHr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [riskResult, setRiskResult] = useState<Record<string, unknown> | null>(null);
  const [lastSubmittedHr, setLastSubmittedHr] = useState<number | null>(null);
  const [pulseEffect, setPulseEffect] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/safety/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const submitVitals = async () => {
    const hrVal = hr ? Number(hr) : null;
    const spo2Val = spo2 ? Number(spo2) : null;
    if (!hrVal && !spo2Val) return;
    setSubmitting(true);
    setSubmitMsg(null);
    setRiskResult(null);
    try {
      const res = await fetch('/api/safety/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heartRate: hrVal,
          spo2: spo2Val,
          timestamp: new Date().toISOString(),
          source: 'manual',
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSubmitMsg('خطأ: ' + data.error);
      } else {
        setRiskResult(data.risk ?? null);
        setLastSubmittedHr(hrVal);
        setPulseEffect(true);
        setTimeout(() => setPulseEffect(false), 2000);
        const level = data.risk?.level;
        if (level === 'critical') setSubmitMsg('تم رصد حالة طوارئ محتملة — تحقق من السبّاح فورًا!');
        else if (level === 'warning') setSubmitMsg('تم رصد تحذير — علامات حيوية غير طبيعية');
        else if (level === 'attention') setSubmitMsg('تم التسجيل — ملاحظة على القراءة');
        else setSubmitMsg('تم تسجيل القراءة — الحالة طبيعية ✓');
        setHr('');
        setSpo2('');
        load();
      }
    } catch {
      setSubmitMsg('فشل التسجيل — تحقق من الاتصال');
    }
    setSubmitting(false);
  };

  const acknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    await fetch('/api/safety/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, action: 'acknowledge' }),
    });
    setAcknowledging(null);
    load();
  };

  const highestRisk = status?.activeAlerts?.length
    ? status.activeAlerts.reduce((max, a) => {
        const order: Record<string, number> = { critical: 4, warning: 3, attention: 2, normal: 1 };
        return (order[a.level] ?? 0) > (order[max.level] ?? 0) ? a : max;
      })
    : null;

  const overallLevel = highestRisk?.level ?? 'normal';
  const riskMeta = RISK_LABELS[overallLevel as keyof typeof RISK_LABELS] ?? RISK_LABELS.normal;

  const v = status?.latestVitals as Record<string, unknown> | null;
  const dataSource = v?.provider as string | undefined;
  const heartRateValue = (v?.heartRate as number) ?? lastSubmittedHr;

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-black text-ocean-900">مراقبة السلامة</h1>
            <p className="text-sm text-slate-500">مراقبة حالة السباح في الوقت الفعلي</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/safety/settings" className="btn-secondary text-xs">
            ⚙️ إعدادات السلامة
          </Link>
          <Link href="/safety/contacts" className="btn-secondary text-xs">
            📞 جهات اتصال الطوارئ
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* نموذج إدخال القراءة الحية من الساعة */}
          <Card className="mb-6 p-5 border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-black text-blue-800">إدخال قراءة الساعة الحية</h2>
            </div>
            <p className="text-xs text-blue-700 mb-3">
              اقرأ النبض من ساعتك وأدخله هنا — السيرفر يقيّم الخطر فورًا ويتصل بالرقم المسجل عند الطوارئ
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">النبض (نبضة/دقيقة)</span>
                <input
                  type="number"
                  min={30}
                  max={250}
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  placeholder="مثال: 81"
                  onKeyDown={(e) => { if (e.key === 'Enter') submitVitals(); }}
                  className="w-36 rounded-lg border border-slate-300 px-3 py-2.5 text-base font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">الأكسجين %</span>
                <input
                  type="number"
                  min={70}
                  max={100}
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  placeholder="اختياري"
                  onKeyDown={(e) => { if (e.key === 'Enter') submitVitals(); }}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2.5 text-base font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <Button
                loading={submitting}
                onClick={submitVitals}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5"
              >
                <Send className="h-4 w-4" />
                تسجيل القراءة
              </Button>
            </div>
            {submitMsg && (
              <div className={`mt-3 text-xs font-bold px-3 py-2 rounded flex items-center gap-2 ${
                submitMsg.includes('طوارئ') ? 'bg-red-100 text-red-700' :
                submitMsg.includes('تحذير') ? 'bg-orange-100 text-orange-700' :
                submitMsg.includes('ملاحظة') ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {submitMsg.includes('طوارئ') ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitMsg}
              </div>
            )}
            {riskResult && (
              <div className="mt-2 text-xs text-slate-600">
                درجة الخطورة: {(riskResult as Record<string, unknown>).score as number}/100
                {(riskResult as Record<string, unknown>).alertId ? ' — تم إنشاء إنذار' : ''}
              </div>
            )}
          </Card>

          {/* الحالة العامة */}
          <Card className={`mb-6 p-6 text-center border-2 ${
            overallLevel === 'critical' ? 'border-red-500 bg-red-50' :
            overallLevel === 'warning' ? 'border-orange-500 bg-orange-50' :
            overallLevel === 'attention' ? 'border-amber-500 bg-amber-50' :
            'border-emerald-300 bg-emerald-50'
          }`}>
            <div className={`text-5xl font-black mb-2 ${
              overallLevel === 'critical' ? 'text-red-600 animate-pulse' :
              overallLevel === 'warning' ? 'text-orange-600' :
              overallLevel === 'attention' ? 'text-amber-600' :
              'text-emerald-600'
            }`}>
              {riskMeta.ar}
            </div>
            <p className="text-lg font-bold text-slate-700">{riskMeta.ar}</p>
            {highestRisk && (
              <p className="text-xs text-slate-500 mt-1">
                درجة الخطورة: {highestRisk.riskScore}/100 — {highestRisk.title}
              </p>
            )}
            <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
              <span>{status?.watchConnected ? '🟢 متصل' : '⚪ غير متصل'}</span>
              <span>البطارية: {status?.batteryLevel != null ? `${status.batteryLevel}%` : '—'}</span>
              <span>آخر تحديث: {status?.lastUpdateAgo}</span>
              {dataSource && (
                <span className="text-blue-600 font-bold">
                  المصدر: {dataSource === 'manual' ? 'إدخال يدوي' : dataSource === 'mobile' ? 'تطبيق الجوال' : dataSource}
                </span>
              )}
            </div>
          </Card>

          {/* إنذارات نشطة */}
          {status?.activeAlerts && status.activeAlerts.length > 0 && (
            <div className="mb-6 space-y-3">
              {status.activeAlerts.map((alert) => (
                <Alert key={alert.id} variant={alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'info'} title={alert.title}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        نبض: {alert.heartRate ?? '—'} | تشبع الأكسجين: {alert.spo2 ?? '—'} | درجة: {alert.riskScore}
                      </p>
                    </div>
                    <Button size="sm" variant="danger" loading={acknowledging === alert.id} onClick={() => acknowledge(alert.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تمت المراجعة
                    </Button>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* المؤشرات الحيوية */}
          <h2 className="mb-3 text-base font-bold text-ocean-900">العلامات الحيوية</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
            <VitalCard
              icon={<HeartPulse className={`h-5 w-5 text-red-500 ${pulseEffect ? 'animate-bounce' : ''}`} />}
              label="معدل ضربات القلب"
              value={heartRateValue}
              unit="نبضة/د"
              warn={heartRateValue != null && (heartRateValue > 180 || heartRateValue < 50)}
              pulse={pulseEffect}
            />
            <VitalCard icon={<Activity className="h-5 w-5 text-blue-500" />} label="تشبع الأكسجين"
              value={v?.spo2 as number} unit="%"
              warn={v ? ((v.spo2 as number) < 92) : false} />
            <VitalCard icon={<Wind className="h-5 w-5 text-cyan-500" />} label="معدل التنفس"
              value={v?.respiratoryRate as number} unit="/دقيقة"
              warn={v ? ((v.respiratoryRate as number) > 25 || (v.respiratoryRate as number) < 10) : false} />
            <VitalCard icon={<Brain className="h-5 w-5 text-purple-500" />} label="تباين نبض القلب"
              value={v?.heartRateVariability as number} unit="مللي ث"
              warn={v ? ((v.heartRateVariability as number) < 25) : false} />
            <VitalCard icon={<Thermometer className="h-5 w-5 text-orange-500" />} label="حرارة الجسم"
              value={v?.bodyTemperature as number} unit="°م"
              warn={v ? ((v.bodyTemperature as number) > 38.5 || (v.bodyTemperature as number) < 36) : false} />
            <VitalCard icon={<Activity className="h-5 w-5 text-amber-500" />} label="مستوى التوتر"
              value={v?.stressLevel as number} unit="/100"
              warn={v ? ((v.stressLevel as number) > 75) : false} />
            <VitalCard icon={<Footprints className="h-5 w-5 text-emerald-500" />} label="الحركة"
              value={v?.movementMagnitude as number} unit="" />
            <VitalCard icon={<Watch className="h-5 w-5 text-slate-500" />} label="حالة التدريب"
              value={null} unit={v?.workoutStatus as string ?? '—'} text />
            <VitalCard icon={<Battery className="h-5 w-5 text-green-500" />} label="البطارية"
              value={status?.batteryLevel} unit="%" />
            <VitalCard icon={<MapPin className="h-5 w-5 text-indigo-500" />} label="الموقع"
              value={null}
              unit={v?.gpsLat ? `${(v.gpsLat as number).toFixed(4)}, ${(v.gpsLng as number).toFixed(4)}` : 'غير متاح'} text />
          </div>

          {/* أحداث السلامة الأخيرة */}
          {status?.recentEvents && status.recentEvents.length > 0 && (
            <>
              <h2 className="mb-3 text-base font-bold text-ocean-900">أحداث السلامة الأخيرة</h2>
              <Card className="p-4">
                <div className="space-y-2">
                  {status.recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
                      <Badge color={event.severity === 'critical' ? 'red' : event.severity === 'warning' ? 'gold' : 'slate'}>
                        {event.severity === 'critical' ? 'حرج' : event.severity === 'warning' ? 'تحذير' : 'ملاحظة'}
                      </Badge>
                      <span className="flex-1 text-sm text-slate-700">{event.description ?? event.eventType}</span>
                      <span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          <Alert variant="info" title="إشعار سلامة" className="mt-6">
            <p className="text-xs">
              هذا النظام هو نظام مساعدة السلامة — وليس أداة تشخيص طبي.
              تأكد دائمًا من وجود إشراف مؤهل أثناء أنشطة السباحة.
            </p>
          </Alert>
        </>
      )}
    </AppShell>
  );
}

function VitalCard({ icon, label, value, unit, warn, text, pulse }: {
  icon: React.ReactNode;
  label: string;
  value: number | string | null | undefined;
  unit: string;
  warn?: boolean;
  text?: boolean;
  pulse?: boolean;
}) {
  return (
    <Card className={`p-3 transition-all duration-300 ${
      pulse ? 'border-red-400 bg-red-50 scale-105 shadow-lg' :
      warn ? 'border-red-300 bg-red-50' : ''
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-bold text-slate-500">{label}</span>
      </div>
      {text ? (
        <p className="text-sm font-black text-slate-700 capitalize">{value ?? unit}</p>
      ) : (
        <p className={`text-xl font-black ${warn ? 'text-red-600' : 'text-slate-800'}`}>
          {value != null ? String(value) : '—'}
          <span className="text-xs font-normal text-slate-400 ms-1">{unit}</span>
        </p>
      )}
    </Card>
  );
}
