'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, X, Utensils, Dumbbell, MessageSquare, Droplets, Sparkles, Info, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActivityItem = {
  id: string;
  kind: 'notification' | 'message' | 'food' | 'training' | 'water' | 'analysis';
  swimmerId: string;
  swimmerName: string;
  swimmerImage: string | null;
  title: string;
  body: string;
  createdAt: string;
  link?: string;
};

const KIND_STYLES: Record<ActivityItem['kind'], { icon: React.ReactNode; cls: string }> = {
  notification: { icon: <Info className="h-4 w-4" />, cls: 'bg-slate-100 text-slate-600' },
  message: { icon: <MessageSquare className="h-4 w-4" />, cls: 'bg-ocean-100 text-ocean-600' },
  food: { icon: <Utensils className="h-4 w-4" />, cls: 'bg-gold-300/40 text-gold-600' },
  training: { icon: <Dumbbell className="h-4 w-4" />, cls: 'bg-emerald-100 text-emerald-600' },
  water: { icon: <Droplets className="h-4 w-4" />, cls: 'bg-lagoon-100 text-lagoon-600' },
  analysis: { icon: <Camera className="h-4 w-4" />, cls: 'bg-violet-100 text-violet-600' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  return `منذ ${day} يوم`;
}

export function AdminActivityBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await fetch('/api/admin/activity');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = items.filter((i) => i.kind === 'message' || i.kind === 'food' || i.kind === 'training').length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ocean-700 ring-1 ring-slate-200 transition-colors hover:bg-ocean-50"
        aria-label="سجل النشاط الشامل"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-black text-ocean-900">سجل النشاط الشامل</h3>
              <p className="text-xs text-slate-400">كل الإشعارات والرسائل والوجبات والتمارين لكل السباحين</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-2">
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">جارٍ التحميل…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">لا يوجد نشاط بعد.</p>
            ) : (
              <div className="space-y-1">
                {items.map((item) => {
                  const style = KIND_STYLES[item.kind];
                  const content = (
                    <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.cls)}>
                        {style.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-800">{item.title}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                        </div>
                        {item.body && <p className="mt-0.5 truncate text-xs text-slate-500">{item.body}</p>}
                        <p className="mt-0.5 text-[10px] font-semibold text-ocean-600">{item.swimmerName}</p>
                      </div>
                    </div>
                  );
                  return item.link ? (
                    <Link key={item.id} href={item.link} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={item.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-2">
            <Link
              href="/admin/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-ocean-50 px-3 py-2 text-xs font-bold text-ocean-700 hover:bg-ocean-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              عرض متابعة السباحين التفصيلية
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
