'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, Badge, EmptyState } from '@/components/ui';

const TYPE_LABELS: Record<string, string> = {
  meal: 'وجبة',
  water: 'ماء',
  training: 'تمرين',
  sleep: 'نوم',
  weight: 'وزن',
  competition: 'بطولة',
  review: 'مراجعة خطة',
  smart: 'تنبيه ذكي',
  message: 'رسالة',
  system: 'النظام',
};

export function NotificationsList() {
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch('/api/notifications?limit=50');
    const data = await res.json();
    setItems(data.items ?? []);
    setUnread(data.unread ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, action: 'read' }),
    });
    load();
  }

  async function dismiss(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], action: 'dismiss' }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-slate-500">آخر التنبيهات الخاصة بك.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="h-4 w-4" />
            تعليم الكل كمقروء
          </Button>
          <Link href="/settings" className="btn-secondary">
            <Settings className="h-4 w-4" />
            إعدادات الإشعارات
          </Link>
        </div>
      </div>

      {loading ? (
        <Card><p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p></Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="لا توجد إشعارات"
          description="ستظهر هنا التنبيهات المتعلقة بالوجبات والماء والتدريب والبطولات. فعّل التذكيرات من الإعدادات."
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => (
            <Card key={n.id} className={!n.isRead ? 'border-ocean-200 bg-ocean-50/40' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-600">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{n.title}</p>
                      <Badge color={n.isRead ? 'slate' : 'ocean'}>{TYPE_LABELS[n.type] ?? n.type}</Badge>
                    </div>
                    {n.body && <p className="mt-1 text-sm text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                {!n.isRead && (
                  <button onClick={() => dismiss(n.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
