/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/messages/messages-view.tsx

وظيفة الملف:
صفحة الرسائل — تعرض قسمين:
1. قائمة المحادثات (يمين): كل محادثة مع شخص + آخر رسالة + عدد غير المقروء.
2. سلسلة المحادثة (يسار): المحادثة نفسها عبر المكوّن ConversationThread.
أيضًا يعرض زر تفعيل إشعارات الهاتف (PushSubscribeButton).

لماذا نحتاجه؟
هذه هي شاشة الرسائل بين السباح والدكتور (أو المدرب).
بدونها لا يوجد تواصل مباشر داخل المنصة.

'use client':
يعمل في المتصفح لأنه يستخدم useState وuseEffect
وتحديث المحادثات كل 10 ثوانٍ (setInterval).

متى يعمل؟
عند فتح /messages.

من يستدعي هذا الملف؟
src/app/messages/page.tsx.

الملفات التي يتعامل معها:
- API: /api/messages/conversations (قائمة المحادثات).
- ConversationThread: المكوّن المعروض داخل السلسلة.
- PushSubscribeButton: زر الإشعارات.
- UserAvatar: صور المستخدمين.
- Card، EmptyState: مكونات واجهة.

ترتيب العمل:
1. التحميل: نجلب قائمة المحادثات ↓
2. نعرض القائمة ونسلّط على المحادثة المختارة ↓
3. كل 10 ثوانٍ نحدّث القائمة تلقائيًا (رسائل جديدة/غير مقروء) ↓
4. عند اختيار محادثة نعرض ConversationThread داخلها
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (كود بعد العرض)، useState (حالة متغيرة).
import { useEffect, useState } from 'react';
// أيقونات من lucide-react: رسالة وسهم رجوع.
import { MessageSquare, ChevronLeft } from 'lucide-react';
// Card، EmptyState: مكونات واجهة جاهزة.
import { Card, EmptyState } from '@/components/ui';
// UserAvatar: صورة المستخدم.
import { UserAvatar } from '@/components/ui/user-avatar';
// ConversationThread: عرض رسائل محادثة واحدة.
import { ConversationThread } from '@/components/messages/conversation-thread';
// PushSubscribeButton: زر إشعارات الهاتف.
import { PushSubscribeButton } from '@/components/messages/push-subscribe-button';

// ========================================
// 2. أنواع البيانات
// ========================================

// Conversation: شكل المحادثة التي نستقبلها من الخادم.
type Conversation = {
  id: string;
  name: string | null;
  image: string | null;
  fullName: string | null;
  role: string;
  // آخر رسالة في المحادثة (أو null لو لا توجد رسائل).
  lastMessage: { id: string; body: string; fromMe: boolean; createdAt: string } | null;
  unread: number; // عدد الرسائل غير المقروءة
};

// displayName: الاسم المعروض للمحادثة — الاسم الكامل إن وجد،
// وإلا اسم الحساب، وإلا "الدكتور" أو "سباح" حسب الدور.
function displayName(c: Conversation): string {
  return c.fullName || c.name || (c.role === 'admin' ? 'الدكتور' : 'سباح');
}

// ========================================
// 3. المكوّن الرئيسي: MessagesView
// ========================================

// MessagesView: الصفحة الكاملة للرسائل.
// Props:
// - myId: معرف المستخدم الحالي (لتحديد الرسائل التي أرسلها هو).
// - myRole: دور المستخدم (admin أو swimmer...) لتغيير النصوص والسلوك.
// - initialUserId: محادثة نفتحها مباشرة (إن وُجدت).
export function MessagesView({
  myId,
  myRole,
  initialUserId,
}: {
  myId: string;
  myRole: string;
  initialUserId?: string;
}) {
  // conversations: قائمة المحادثات.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // selected: معرف المحادثة المعروضة حاليًا في الجهة اليسرى.
  const [selected, setSelected] = useState<string | null>(initialUserId ?? null);
  const [loading, setLoading] = useState(true);
  // mobileOpen: في الشاشات الصغيرة نعرض إما القائمة أو المحادثة.
  const [mobileOpen, setMobileOpen] = useState(false);

  // load: جلب قائمة المحادثات من الخادم.
  const load = async () => {
    const res = await fetch('/api/messages/conversations');
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
      // غير الأدمن: نفتح أول محادثة تلقائيًا.
      if (myRole !== 'admin' && data.conversations?.length > 0) {
        setSelected(data.conversations[0].id);
      } else if (initialUserId) {
        // لو طلبنا فتح محادثة محددة وهي موجودة نختارها.
        const exists = data.conversations?.some((c: Conversation) => c.id === initialUserId);
        if (exists) setSelected(initialUserId);
      }
    }
    setLoading(false);
  };

  // عند أول ظهور نحمّل، ثم نعيد التحميل كل 10 ثوانٍ (رسائل جديدة).
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t); // تنظيف المؤقّت عند الخروج.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // current: المحادثة المختارة حاليًا (للتمرير إليها في السلسلة).
  const current = conversations.find((c) => c.id === selected) ?? null;

  return (
    <div>
      {/* رأس الصفحة: العنوان + زر الإشعارات */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">الرسائل</h1>
          <p className="mt-1 text-sm text-slate-500">
            {myRole === 'admin' ? 'تواصل مباشر مع سباحيك.' : 'تواصل مباشر مع الدكتور.'}
          </p>
        </div>
        <PushSubscribeButton />
      </div>

      {/* شبكة من عمودين: القائمة (يمين) + السلسلة (يسار) */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* قائمة المحادثات */}
        <div className={`lg:block ${mobileOpen ? 'hidden' : 'block'}`}>
          <Card className="overflow-hidden !p-0">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
            ) : conversations.length === 0 ? (
              // لا محادثات: رسالة فارغة حسب الدور.
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title={myRole === 'admin' ? 'لا توجد محادثات بعد' : 'لا توجد محادثة بعد'}
                description={
                  myRole === 'admin'
                    ? 'عندما يرسل لك السباحون رسائل ستظهر هنا.'
                    : 'سجل دخولك وابدأ محادثة مع الدكتور من هذا الرابط.'
                }
              />
            ) : (
              // map: نعرض زرًا لكل محادثة.
              <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setMobileOpen(true); // في الجوال ننتقل لعرض السلسلة
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-ocean-50 ${
                      selected === c.id ? 'bg-ocean-50/70' : ''
                    }`}
                  >
                    <UserAvatar name={displayName(c)} image={c.image} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        {/* اسم الشخص */}
                        <p className="truncate text-sm font-bold text-slate-800">{displayName(c)}</p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {new Date(c.lastMessage.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {/* آخر رسالة: إن كانت مني نضع "أنت: " قبلها */}
                        <p className="truncate text-xs text-slate-500">
                          {c.lastMessage
                            ? `${c.lastMessage.fromMe ? 'أنت: ' : ''}${c.lastMessage.body}`
                            : 'لا توجد رسائل بعد'}
                        </p>
                        {/* عداد غير المقروء: دائرة حمراء بالرقم */}
                        {c.unread > 0 && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* سلسلة المحادثة */}
        <div className={`${mobileOpen ? 'block' : 'hidden lg:block'}`}>
          <Card className="h-[70vh] overflow-hidden !p-0">
            {selected && current ? (
              // لدينا محادثة مختارة → نعرضها داخل ConversationThread
              <ConversationThread
                peerId={current.id}
                peerName={displayName(current)}
                peerImage={current.image}
                myId={myId}
                onBack={() => setMobileOpen(false)} // زر الرجوع في الجوال
              />
            ) : myRole === 'admin' ? (
              // لا اختيار بعد للأدمن: رسالة اختيار.
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <ChevronLeft className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">اختر سباحًا لعرض محادثته.</p>
              </div>
            ) : (
              // لا محادثات للسباح: رسالة فارغة.
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <MessageSquare className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">رسالتك ستظهر هنا.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
