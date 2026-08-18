'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Plus, Trash2, ArrowRight, Star } from 'lucide-react';
import { Card, Badge, Alert } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/app-shell';
import type { SessionUser } from '@/lib/auth';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
  isPrimary: boolean;
  notifyOnCritical: boolean;
  notifyOnWarning: boolean;
}

const RELATIONSHIPS: Record<string, string> = {
  parent: 'والد/والدة', guardian: 'ولي أمر', coach: 'مدرب',
  lifeguard: 'منقذ', doctor: 'طبيب', nurse: 'ممرض/ة',
  sibling: 'أخ/أخت', spouse: 'زوج/زوجة', friend: 'صديق', other: 'أخرى',
};

export function SafetyContactsPage({ user }: { user: SessionUser }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', relationship: 'parent', priority: 1, isPrimary: false,
    notifyOnCritical: true, notifyOnWarning: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/safety/contacts');
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    setError('');
    if (!form.name.trim() || !form.phone.trim()) {
      setError('الاسم والهاتف مطلوبان');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/safety/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setShowForm(false);
      setForm({ name: '', phone: '', relationship: 'parent', priority: 1, isPrimary: false, notifyOnCritical: true, notifyOnWarning: true });
      load();
    } else {
      setError(data.error ?? 'خطأ');
    }
  };

  const remove = async (contactId: string) => {
    if (!confirm('هل تريد إزالة جهة اتصال الطوارئ هذه؟')) return;
    await fetch('/api/safety/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    });
    load();
  };

  return (
    <AppShell user={user}>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/safety" className="text-slate-400 hover:text-ocean-600">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <Phone className="h-7 w-7 text-emerald-600" />
        <h1 className="text-2xl font-black text-ocean-900">جهات اتصال الطوارئ</h1>
      </div>

      <Alert variant="info" title="مهم" className="mb-6">
        <p className="text-sm">
          هذه الجهات ستُبلغ عند اكتشاف حالة طوارئ محتملة.
          في حالة الطوارئ الحقيقية، اتصل برقم الطوارئ المحلي مباشرة.
        </p>
      </Alert>

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4" />
          {showForm ? 'إلغاء' : 'إضافة جهة اتصال'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-6 border-emerald-200 bg-emerald-50">
          <h3 className="mb-3 font-bold text-ocean-900">جهة اتصال طوارئ جديدة</h3>
          {error && <Alert variant="danger" title="خطأ"><p className="text-sm">{error}</p></Alert>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الكامل *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="مثال: أحمد محمد" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الهاتف *</label>
              <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="+20 1XX XXX XXXX" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">صلة القرابة</label>
              <select value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {Object.entries(RELATIONSHIPS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الأولوية (1 = الأعلى)</label>
              <input type="number" min={1} max={10} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(p => ({ ...p, isPrimary: e.target.checked }))} className="h-4 w-4" />
                <span className="text-sm text-slate-700">أساسي</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.notifyOnCritical} onChange={e => setForm(p => ({ ...p, notifyOnCritical: e.target.checked }))} className="h-4 w-4" />
                <span className="text-sm text-slate-700">تنبيهات حرجة</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.notifyOnWarning} onChange={e => setForm(p => ({ ...p, notifyOnWarning: e.target.checked }))} className="h-4 w-4" />
                <span className="text-sm text-slate-700">تنبيهات تحذيرية</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={add} loading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" />
              حفظ جهة الاتصال
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        </div>
      ) : contacts.length === 0 ? (
        <Card className="p-8 text-center">
          <Phone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500 mb-2">لم تُضف جهات اتصال طوارئ بعد</p>
          <p className="text-xs text-slate-400">اضغط &quot;إضافة جهة اتصال&quot; لتحديد من يجب إبلاغهم في حالة الطوارئ</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{c.name}</span>
                      {c.isPrimary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                      <Badge color="slate">{RELATIONSHIPS[c.relationship] ?? c.relationship}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">{c.phone} · الأولوية {c.priority}</p>
                    <div className="flex gap-2 mt-1">
                      {c.notifyOnCritical && <Badge color="red">حرج</Badge>}
                      {c.notifyOnWarning && <Badge color="gold">تحذير</Badge>}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => remove(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
