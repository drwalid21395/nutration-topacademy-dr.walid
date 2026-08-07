'use client';

import { useEffect, useState } from 'react';
import { Bell, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Toggle, Field } from '@/components/ui/forms';
import { Card, Alert, Badge } from '@/components/ui';
import { MEAL_TYPES } from '@/lib/constants';

const TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00',
];

const DAYS = [
  { key: 'sat', label: 'السبت' },
  { key: 'sun', label: 'الأحد' },
  { key: 'mon', label: 'الإثنين' },
  { key: 'tue', label: 'الثلاثاء' },
  { key: 'wed', label: 'الأربعاء' },
  { key: 'thu', label: 'الخميس' },
  { key: 'fri', label: 'الجمعة' },
];

export function NotificationPrefs() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notification-prefs')
      .then((r) => r.json())
      .then((d) => {
        if (d.prefs) setForm({ ...d.prefs, days: d.prefs.days ?? ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch('/api/notification-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'تعذر الحفظ');
      return;
    }
    setMessage('تم حفظ إعدادات الإشعارات.');
  }

  function toggleDay(k: string) {
    const days = form.days ?? [];
    setForm({
      ...form,
      days: days.includes(k) ? days.filter((d: string) => d !== k) : [...days, k],
    });
  }

  return (
    <div>
      {message && <div className="mb-4"><Alert variant="success"><span className="flex items-center gap-1"><Check className="h-4 w-4" /> {message}</span></Alert></div>}
      {error && <div className="mb-4"><Alert variant="danger">{error}</Alert></div>}

      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-ocean-900"><Bell className="h-4 w-4 text-ocean-500" /> تذكيرات الوجبات</h2>
        <p className="mb-4 text-sm text-slate-500">حدد مواعيد التذكير بوجباتك اليومية. تعمل الإشعارات بعد تفعيلها وتثبيت التطبيق (PWA).</p>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">جارٍ التحميل…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['breakfast', 'lunch', 'dinner'] as const).map((k) => (
                <Field key={k} label={MEAL_TYPES[k]}>
                  <Select value={form[k + 'Time'] ?? ''} onChange={(e) => setForm({ ...form, [k + 'Time']: e.target.value })}>
                    <option value="">إيقاف</option>
                    {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="قبل التمرين">
                <Select value={form.preWorkoutTime ?? ''} onChange={(e) => setForm({ ...form, preWorkoutTime: e.target.value })}>
                  <option value="">إيقاف</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="بعد التمرين">
                <Select value={form.postWorkoutTime ?? ''} onChange={(e) => setForm({ ...form, postWorkoutTime: e.target.value })}>
                  <option value="">إيقاف</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="وزن يومي">
                <Select value={form.weighInTime ?? ''} onChange={(e) => setForm({ ...form, weighInTime: e.target.value })}>
                  <option value="">إيقاف</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="نوم (تنبيه بموعد النوم)">
                <Select value={form.sleepTime ?? ''} onChange={(e) => setForm({ ...form, sleepTime: e.target.value })}>
                  <option value="">إيقاف</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="كل كم دقيقة للتذكير بالماء؟">
              <Select value={form.waterInterval ?? 60} onChange={(e) => setForm({ ...form, waterInterval: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} دقيقة</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-4 text-base font-bold text-ocean-900">أيام العمل بالتذكيرات</h2>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={
                'rounded-xl border px-4 py-2 text-sm font-bold transition-colors ' +
                (form.days?.includes(d.key) ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
              }
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-4 text-base font-bold text-ocean-900">تفضيلات عامة</h2>
        <div className="space-y-3">
          <Toggle
            checked={!!form.pushEnabled}
            onChange={(v) => setForm({ ...form, pushEnabled: v })}
            label="الإشعارات الفورية (Push)"
            description="عند تثبيت التطبيق من المتصفح"
          />
          <Toggle
            checked={!!form.inAppEnabled}
            onChange={(v) => setForm({ ...form, inAppEnabled: v })}
            label="إشعارات داخل التطبيق"
          />
          <Toggle
            checked={!!form.smartAlerts}
            onChange={(v) => setForm({ ...form, smartAlerts: v })}
            label="تنبيهات ذكية"
            description="مثل نسيان تسجيل وجبة أو تذكير بالماء عند الجفاف"
          />
          <Toggle
            checked={!!form.soundEnabled}
            onChange={(v) => setForm({ ...form, soundEnabled: v })}
            label="صوت التنبيه"
          />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Field label="بداية ساعات الهدوء">
              <Input type="time" value={form.quietHoursStart ?? ''} onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })} />
            </Field>
            <Field label="نهاية ساعات الهدوء">
              <Input type="time" value={form.quietHoursEnd ?? ''} onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="تذكير قبل البطولة (أيام)">
              <Input type="number" min={1} max={30} value={form.competitionReminderDays ?? 7} onChange={(e) => setForm({ ...form, competitionReminderDays: Number(e.target.value) })} />
            </Field>
            <Field label="تذكير بمراجعة الخطة (أيام)">
              <Input type="number" min={1} max={60} value={form.planReviewReminderDays ?? 14} onChange={(e) => setForm({ ...form, planReviewReminderDays: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
        <div className="mt-5">
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            حفظ الإعدادات
          </Button>
        </div>
      </Card>
    </div>
  );
}
