'use client';

import { useEffect, useState } from 'react';
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

  const load = async () => {
    try {
      const res = await fetch('/api/safety/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-black text-ocean-900">Safety Monitor</h1>
            <p className="text-sm text-slate-500">实时监控游泳者安全状态</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/safety/settings" className="btn-secondary text-xs">
            Safety Settings
          </Link>
          <Link href="/safety/contacts" className="btn-secondary text-xs">
            Emergency Contacts
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Overall status */}
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
              {riskMeta.en}
            </div>
            <p className="text-lg font-bold text-slate-700">{riskMeta.ar}</p>
            {highestRisk && (
              <p className="text-xs text-slate-500 mt-1">
                Risk Score: {highestRisk.riskScore}/100 — {highestRisk.title}
              </p>
            )}
            <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
              <span>{status?.watchConnected ? '🟢 Connected' : '⚪ Disconnected'}</span>
              <span>Battery: {status?.batteryLevel != null ? `${status.batteryLevel}%` : '—'}</span>
              <span>Last: {status?.lastUpdateAgo}</span>
            </div>
          </Card>

          {/* Active alerts */}
          {status?.activeAlerts && status.activeAlerts.length > 0 && (
            <div className="mb-6 space-y-3">
              {status.activeAlerts.map((alert) => (
                <Alert key={alert.id} variant={alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'info'} title={alert.title}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        HR: {alert.heartRate ?? '—'} | SpO2: {alert.spo2 ?? '—'} | Score: {alert.riskScore}
                      </p>
                    </div>
                    <Button size="sm" variant="danger" loading={acknowledging === alert.id} onClick={() => acknowledge(alert.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Acknowledged
                    </Button>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Vital signs grid */}
          <h2 className="mb-3 text-base font-bold text-ocean-900">Vital Signs</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
            <VitalCard icon={<HeartPulse className="h-5 w-5 text-red-500" />} label="Heart Rate"
              value={v?.heartRate as number} unit="bpm"
              warn={v ? ((v.heartRate as number) > 180 || (v.heartRate as number) < 50) : false} />
            <VitalCard icon={<Activity className="h-5 w-5 text-blue-500" />} label="SpO2"
              value={v?.spo2 as number} unit="%"
              warn={v ? ((v.spo2 as number) < 92) : false} />
            <VitalCard icon={<Wind className="h-5 w-5 text-cyan-500" />} label="Respiratory"
              value={v?.respiratoryRate as number} unit="/min"
              warn={v ? ((v.respiratoryRate as number) > 25 || (v.respiratoryRate as number) < 10) : false} />
            <VitalCard icon={<Brain className="h-5 w-5 text-purple-500" />} label="HRV"
              value={v?.hrv as number} unit="ms"
              warn={v ? ((v.hrv as number) < 25) : false} />
            <VitalCard icon={<Thermometer className="h-5 w-5 text-orange-500" />} label="Temp"
              value={v?.bodyTemperature as number} unit="°C"
              warn={v ? ((v.bodyTemperature as number) > 38.5 || (v.bodyTemperature as number) < 36) : false} />
            <VitalCard icon={<Activity className="h-5 w-5 text-amber-500" />} label="Stress"
              value={v?.stressLevel as number} unit="/100"
              warn={v ? ((v.stressLevel as number) > 75) : false} />
            <VitalCard icon={<Footprints className="h-5 w-5 text-emerald-500" />} label="Movement"
              value={v?.movementMagnitude as number} unit="" />
            <VitalCard icon={<Watch className="h-5 w-5 text-slate-500" />} label="Workout"
              value={null} unit={v?.workoutStatus as string ?? '—'} text />
            <VitalCard icon={<Battery className="h-5 w-5 text-green-500" />} label="Battery"
              value={status?.batteryLevel} unit="%" />
            <VitalCard icon={<MapPin className="h-5 w-5 text-indigo-500" />} label="Location"
              value={null}
              unit={v?.gpsLat ? `${(v.gpsLat as number).toFixed(4)}, ${(v.gpsLng as number).toFixed(4)}` : 'N/A'} text />
          </div>

          {/* Recent events */}
          {status?.recentEvents && status.recentEvents.length > 0 && (
            <>
              <h2 className="mb-3 text-base font-bold text-ocean-900">Recent Safety Events</h2>
              <Card className="p-4">
                <div className="space-y-2">
                  {status.recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
                      <Badge color={event.severity === 'critical' ? 'red' : event.severity === 'warning' ? 'gold' : 'slate'}>
                        {event.severity}
                      </Badge>
                      <span className="flex-1 text-sm text-slate-700">{event.description ?? event.eventType}</span>
                      <span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          <Alert variant="info" title="Safety Notice" className="mt-6">
            <p className="text-xs">
              This system is a Safety Assistance System — not a medical diagnostic device.
              Always ensure qualified supervision during swimming activities.
              Possible Emergency Detected — Check Swimmer Immediately.
            </p>
          </Alert>
        </>
      )}
    </AppShell>
  );
}

function VitalCard({ icon, label, value, unit, warn, text }: {
  icon: React.ReactNode;
  label: string;
  value: number | string | null | undefined;
  unit: string;
  warn?: boolean;
  text?: boolean;
}) {
  return (
    <Card className={`p-3 ${warn ? 'border-red-300 bg-red-50' : ''}`}>
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
