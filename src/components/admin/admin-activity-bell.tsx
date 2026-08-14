/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/admin/admin-activity-bell.tsx

وظيفة الملف:
زر "الجرس" في لوحة الإدارة — يعرض سجل النشاط الشامل
لكل السباحين: إشعارات، رسائل، وجبات مسجلة، تمارين، ماء،
وتحليلات بالكاميرا. يتحدث تلقائيًا كل 30 ثانية.

لماذا نحتاجه؟
يحتاج المدير/الأدمن رؤية كل ما يحدث في المنصة من مكان واحد،
مع عدد العناصر غير المقروءة (العد الأحمر على الجرس).

'use client':
هذا المكوّن يعمل في المتصفح لأنه يستخدم useState وuseEffect
وfetch وonClick — كلها أشياء لا توجد في الخادم.

متى يعمل؟
عند عرضه داخل لوحة الإدارة /admin/dashboard.

من يستدعي هذا الملف؟
src/components/admin/admin-dashboard.tsx (يضعه في رأس اللوحة).

الملفات التي يتعامل معها:
- API: /api/admin/activity (جلب السجل الشامل).
- lib/utils: cn (دمج أسماء فئات Tailwind).
- next/link للتنقل (لوحة الإدارة، صفحات السباحين).

ترتيب العمل:
1. المستخدم يفتح لوحة الإدارة ↓
2. المكوّن يطلب /api/admin/activity عند التحميل ↓
3. يتحدث تلقائيًا كل 30 ثانية (setInterval) ↓
4. عند الضغط على الجرس تظهر اللوحة المنبثقة ↓
5. الضغط خارج اللوحة يغلقها (مستمع mousedown)
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (كود بعد العرض)، useRef (مرجع لعنصر HTML)، useState (حالة متغيرة) — من مكتبة react.
import { useEffect, useRef, useState } from 'react';
// Link من next/link: تنقل بين الصفحات دون إعادة تحميل كاملة.
import Link from 'next/link';
// أيقونات من lucide-react (مكتبة أيقونات خارجية): كل نوع نشاط له أيقونة.
import { Bell, X, Utensils, Dumbbell, MessageSquare, Droplets, Sparkles, Info, Camera } from 'lucide-react';
// cn من lib/utils: دالة مساعدة لدمج أسماء فئات Tailwind شرطيًا.
import { cn } from '@/lib/utils';

// ========================================
// 2. نوع البيانات ActivityItem
// ========================================

// ActivityItem: شكل عنصر النشاط الواحد القادم من الخادم.
// kind = نوع النشاط (إشعار/رسالة/طعام/تمرين/ماء/تحليل).
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

// ========================================
// 3. الثوابت: شكل كل نوع نشاط
// ========================================

// KIND_STYLES: لكل نوع نشاط أيقونة ولون خلفية يميزه في القائمة.
// Record<مفتاح, قيمة>: خريطة من نوع النشاط إلى الأيقونة والفئة.
const KIND_STYLES: Record<ActivityItem['kind'], { icon: React.ReactNode; cls: string }> = {
  notification: { icon: <Info className="h-4 w-4" />, cls: 'bg-slate-100 text-slate-600' },
  message: { icon: <MessageSquare className="h-4 w-4" />, cls: 'bg-ocean-100 text-ocean-600' },
  food: { icon: <Utensils className="h-4 w-4" />, cls: 'bg-gold-300/40 text-gold-600' },
  training: { icon: <Dumbbell className="h-4 w-4" />, cls: 'bg-emerald-100 text-emerald-600' },
  water: { icon: <Droplets className="h-4 w-4" />, cls: 'bg-lagoon-100 text-lagoon-600' },
  analysis: { icon: <Camera className="h-4 w-4" />, cls: 'bg-violet-100 text-violet-600' },
};

// ========================================
// 4. دالة مساعدة: timeAgo
// ========================================

// timeAgo: تحويل تاريخ (ISO) إلى نص مثل "منذ 5 دقائق".
// نحسب الفرق بين الآن وتاريخ النشاط بالملي ثانية.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000); // 60000 = دقيقة بالملي ثانية
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  return `منذ ${day} يوم`;
}

// ========================================
// 5. المكوّن الرئيسي: AdminActivityBell
// ========================================

// AdminActivityBell: زر الجرس + اللوحة المنبثقة بسجل النشاط.
// Props: لا يستقبل أي بيانات — كل شيء يجيبه من الخادم.
export function AdminActivityBell() {
  // open: هل اللوحة المنبثقة مفتوحة؟
  const [open, setOpen] = useState(false);
  // items: قائمة عناصر النشاط القادمة من الخادم.
  const [items, setItems] = useState<ActivityItem[]>([]);
  // loading: هل الجلب ما زال قيد التنفيذ؟
  const [loading, setLoading] = useState(true);
  // panelRef: مرجع لصندوق الجرس — لنعرف إن ضغط المستخدم خارجه.
  const panelRef = useRef<HTMLDivElement>(null);

  // load: دالة جلب النشاط من الخادم (المسار /api/admin/activity).
  const load = async () => {
    const res = await fetch('/api/admin/activity');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  };

  // عند أول ظهور للمكوّن: نجلب النشاط، ثم نبدأ مؤقتًا كل 30 ثانية.
  // العودة في آخر الدالة = تنظيف المؤقت عند إزالة المكوّن.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // عند الضغط بالفأرة خارج اللوحة نغلقها (وليس داخل الجرس).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // unreadCount: عدد الرسائل/الطعام/التمارين — تُعد "غير مقروءة" للعد الأحمر.
  const unreadCount = items.filter((i) => i.kind === 'message' || i.kind === 'food' || i.kind === 'training').length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ocean-700 ring-1 ring-slate-200 transition-colors hover:bg-ocean-50"
        aria-label="سجل النشاط الشامل"
      >
        <Bell className="h-5 w-5" />
        {/* العد الأحمر: يظهر فقط لو كان هناك عناصر غير مقروءة */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* اللوحة المنبثقة: تظهر فقط عندما open == true */}
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
            {/* شرط ثلاثي: تحميل؟ أم لا يوجد نشاط؟ أم نعرض القائمة؟ */}
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">جارٍ التحميل…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">لا يوجد نشاط بعد.</p>
            ) : (
              <div className="space-y-1">
                {/* map: نكرر على كل عنصر لنعرض سطرًا لكل نشاط */}
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
                  // لو للعنصر رابط → نغلفه بـ Link، وإلا نعرضه كعنصر عادي.
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
