/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/notifications/notifications-list.tsx

وظيفة الملف:
صفحة الإشعارات — تعرض آخر 50 إشعارًا للمستخدم مع:
- شارة نوع كل إشعار (وجبة، ماء، تمرين، بطولة...).
- تمييز الإشعار غير المقروء بلون أزرق فاتح.
- زر "تعليم الكل كمقروء".
- زر حذف لكل إشعار غير مقروء.
- رابط لإعدادات الإشعارات.

لماذا نحتاجه؟
هي الشاشة التي يراها المستخدم ليعرف كل التنبيهات
التي أرسلها النظام له (تذكيرات، بطولات، رسائل...).

'use client':
يعمل في المتصفح لأنه يستخدم useState وuseEffect وfetch.

متى يعمل؟
عند فتح /notifications.

من يستدعي هذا الملف؟
src/app/notifications/page.tsx.

الملفات التي يتعامل معها:
- API: /api/notifications (GET قائمة، PATCH مقروء/حذف).
- مكونات: Button، Card، Badge، EmptyState.
- lucide-react: أيقونات.

ترتيب العمل:
1. نجلب آخر 50 إشعارًا وعدد غير المقروء ↓
2. نعرض بطاقة لكل إشعار (غير المقروء بلون مميز) ↓
3. "تعليم الكل كمقروء" → PATCH للكل ثم إعادة تحميل ↓
4. زر الحذف → PATCH لهذا الإشعار فقط
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (تحميل أولي)، useState (حالة متغيرة).
import { useEffect, useState } from 'react';
// أيقونات: جرس، تعليم الكل، حذف، إعدادات.
import { Bell, CheckCheck, Trash2, Settings } from 'lucide-react';
// Link: رابط إعدادات الإشعارات.
import Link from 'next/link';
// Button: زر جاهز.
import { Button } from '@/components/ui/button';
// مكونات واجهة.
import { Card, Badge, EmptyState } from '@/components/ui';

// ========================================
// 2. بيانات ثابتة
// ========================================

// TYPE_LABELS: ترجمة نوع الإشعار (المفتاح في قاعدة البيانات)
// إلى اسم عربي معروض على الشارة.
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

// ========================================
// 3. المكوّن الرئيسي: NotificationsList
// ========================================

export function NotificationsList() {
  // items: قائمة الإشعارات.
  const [items, setItems] = useState<any[]>([]);
  // unread: عدد غير المقروء (لتفعيل/تعطيل زر "تعليم الكل").
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  // load: جلب آخر 50 إشعارًا + عدد غير المقروء.
  const load = async () => {
    const res = await fetch('/api/notifications?limit=50');
    const data = await res.json();
    setItems(data.items ?? []);
    setUnread(data.unread ?? 0);
    setLoading(false);
  };

  // عند أول ظهور نجلب الإشعارات.
  useEffect(() => {
    load();
  }, []);

  // markAll: تعليم كل الإشعارات كمقروء (PATCH مرة واحدة).
  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, action: 'read' }),
    });
    load();
  }

  // dismiss: حذف (إخفاء) إشعار واحد بمعرفه.
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
      {/* رأس الصفحة: العنوان + الأزرار */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-slate-500">آخر التنبيهات الخاصة بك.</p>
        </div>
        <div className="flex gap-2">
          {/* زر تعليم الكل كمقروء — معطّل إن لم توجد إشعارات غير مقروءة */}
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
        // قائمة الإشعارات: بطاقة لكل إشعار
        <div className="space-y-2.5">
          {items.map((n) => (
            // غير المقروء: إطار وإطار أزرق فاتح للتمييز.
            <Card key={n.id} className={!n.isRead ? 'border-ocean-200 bg-ocean-50/40' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* أيقونة الجرس */}
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-600">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{n.title}</p>
                      {/* شارة نوع الإشعار (مقروء = رمادي، جديد = أزرق) */}
                      <Badge color={n.isRead ? 'slate' : 'ocean'}>{TYPE_LABELS[n.type] ?? n.type}</Badge>
                    </div>
                    {n.body && <p className="mt-1 text-sm text-slate-500">{n.body}</p>}
                    {/* وقت الإشعار */}
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                {/* زر الحذف يظهر فقط للإشعار غير المقروء */}
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
