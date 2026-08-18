'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Save, ArrowRight } from 'lucide-react';
import { Card, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/app-shell';
import type { SessionUser } from '@/lib/auth';

interface SafetySettings {
  heartRateCriticalHigh: number;
  heartRateCriticalLow: number;
  heartRateWarningHigh: number;
  heartRateWarningLow: number;
  spo2CriticalLow: number;
  spo2WarningLow: number;
  respiratoryRateCriticalHigh: number;
  respiratoryRateCriticalLow: number;
  respiratoryRateWarningHigh: number;
  respiratoryRateWarningLow: number;
  hrvCriticalLow: number;
  hrvWarningLow: number;
  temperatureCriticalHigh: number;
  temperatureWarningHigh: number;
  temperatureCriticalLow: number;
  temperatureWarningLow: number;
  stressCriticalHigh: number;
  stressWarningHigh: number;
  noMovementDurationSec: number;
  noMovementSwimDurationSec: number;
  cooldownMinutes: number;
  enabled: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  autoCallEmergency: boolean;
}

const DEFAULTS: SafetySettings = {
  heartRateCriticalHigh: 200, heartRateCriticalLow: 40,
  heartRateWarningHigh: 180, heartRateWarningLow: 50,
  spo2CriticalLow: 90, spo2WarningLow: 93,
  respiratoryRateCriticalHigh: 30, respiratoryRateCriticalLow: 8,
  respiratoryRateWarningHigh: 25, respiratoryRateWarningLow: 10,
  hrvCriticalLow: 20, hrvWarningLow: 25,
  temperatureCriticalHigh: 39, temperatureWarningHigh: 38.5,
  temperatureCriticalLow: 35.5, temperatureWarningLow: 36,
  stressCriticalHigh: 90, stressWarningHigh: 75,
  noMovementDurationSec: 30, noMovementSwimDurationSec: 25,
  cooldownMinutes: 10,
  enabled: true, soundEnabled: true, hapticEnabled: true, autoCallEmergency: false,
};

export function SafetySettingsPage({ user }: { user: SessionUser }) {
  const [settings, setSettings] = useState<SafetySettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/safety/settings').then(r => r.json()).then(d => {
      if (d.settings) setSettings(prev => ({ ...prev, ...d.settings }));
    });
  }, []);

  const update = (key: keyof SafetySettings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await fetch('/api/safety/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
  };

  return (
    <AppShell user={user}>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/safety" className="text-slate-400 hover:text-ocean-600">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <ShieldCheck className="h-7 w-7 text-emerald-600" />
        <h1 className="text-2xl font-black text-ocean-900">عتبات السلامة</h1>
      </div>

      <Card className="p-4 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.enabled} onChange={e => update('enabled', e.target.checked)} className="h-4 w-4" />
          <span className="font-bold text-slate-700">تفعيل مراقبة السلامة</span>
        </label>
      </Card>

      <div className="space-y-6">
        <Section title="❤️ معدل ضربات القلب (نبضة/دقيقة)">
          <NumField label="حرج مرتفع" value={settings.heartRateCriticalHigh} onChange={v => update('heartRateCriticalHigh', v)} />
          <NumField label="تحذير مرتفع" value={settings.heartRateWarningHigh} onChange={v => update('heartRateWarningHigh', v)} />
          <NumField label="تحذير منخفض" value={settings.heartRateWarningLow} onChange={v => update('heartRateWarningLow', v)} />
          <NumField label="حرج منخفض" value={settings.heartRateCriticalLow} onChange={v => update('heartRateCriticalLow', v)} />
        </Section>

        <Section title="🫁 تشبع الأكسجين (%)">
          <NumField label="حرج منخفض" value={settings.spo2CriticalLow} onChange={v => update('spo2CriticalLow', v)} />
          <NumField label="تحذير منخفض" value={settings.spo2WarningLow} onChange={v => update('spo2WarningLow', v)} />
        </Section>

        <Section title="🌬️ معدل التنفس (نفس/دقيقة)">
          <NumField label="حرج مرتفع" value={settings.respiratoryRateCriticalHigh} onChange={v => update('respiratoryRateCriticalHigh', v)} />
          <NumField label="تحذير مرتفع" value={settings.respiratoryRateWarningHigh} onChange={v => update('respiratoryRateWarningHigh', v)} />
          <NumField label="تحذير منخفض" value={settings.respiratoryRateWarningLow} onChange={v => update('respiratoryRateWarningLow', v)} />
          <NumField label="حرج منخفض" value={settings.respiratoryRateCriticalLow} onChange={v => update('respiratoryRateCriticalLow', v)} />
        </Section>

        <Section title="💓 تباين نبض القلب (مللي ثانية)">
          <NumField label="حرج منخفض" value={settings.hrvCriticalLow} onChange={v => update('hrvCriticalLow', v)} />
          <NumField label="تحذير منخفض" value={settings.hrvWarningLow} onChange={v => update('hrvWarningLow', v)} />
        </Section>

        <Section title="🌡️ حرارة الجسم (مئوية)">
          <NumField label="حرج مرتفع" value={settings.temperatureCriticalHigh} onChange={v => update('temperatureCriticalHigh', v)} />
          <NumField label="تحذير مرتفع" value={settings.temperatureWarningHigh} onChange={v => update('temperatureWarningHigh', v)} />
          <NumField label="تحذير منخفض" value={settings.temperatureWarningLow} onChange={v => update('temperatureWarningLow', v)} />
          <NumField label="حرج منخفض" value={settings.temperatureCriticalLow} onChange={v => update('temperatureCriticalLow', v)} />
        </Section>

        <Section title="🧠 مستوى التوتر (/100)">
          <NumField label="حرج مرتفع" value={settings.stressCriticalHigh} onChange={v => update('stressCriticalHigh', v)} />
          <NumField label="تحذير مرتفع" value={settings.stressWarningHigh} onChange={v => update('stressWarningHigh', v)} />
        </Section>

        <Section title="🏊 كشف الحركة (ثواني)">
          <NumField label="بدون حركة (عادي)" value={settings.noMovementDurationSec} onChange={v => update('noMovementDurationSec', v)} />
          <NumField label="بدون حركة (سباحة)" value={settings.noMovementSwimDurationSec} onChange={v => update('noMovementSwimDurationSec', v)} />
        </Section>

        <Section title="⚙️ عام">
          <NumField label="فترة الهدوء (دقيقة)" value={settings.cooldownMinutes} onChange={v => update('cooldownMinutes', v)} />
          <label className="flex items-center gap-3 cursor-pointer py-2">
            <input type="checkbox" checked={settings.soundEnabled} onChange={e => update('soundEnabled', e.target.checked)} className="h-4 w-4" />
            <span className="text-sm text-slate-700">تنبيهات صوتية</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer py-2">
            <input type="checkbox" checked={settings.hapticEnabled} onChange={e => update('hapticEnabled', e.target.checked)} className="h-4 w-4" />
            <span className="text-sm text-slate-700">تنبيهات اهتزازية</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer py-2">
            <input type="checkbox" checked={settings.autoCallEmergency} onChange={e => update('autoCallEmergency', e.target.checked)} className="h-4 w-4" />
            <span className="text-sm text-slate-700">اتصال تلقائي بالطوارئ (قريبًا)</span>
          </label>
        </Section>
      </div>

      {saved && (
        <Alert variant="success" title="تم الحفظ" className="mt-4">
          <p className="text-sm">تم تحديث عتبات السلامة بنجاح.</p>
        </Alert>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={save} loading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="h-4 w-4" />
          حفظ الإعدادات
        </Button>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-bold text-ocean-900">{title}</h3>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-right focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500"
      />
    </label>
  );
}
