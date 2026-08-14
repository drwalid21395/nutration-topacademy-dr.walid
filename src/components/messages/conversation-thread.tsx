/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/messages/conversation-thread.tsx

وظيفة الملف:
عرض محادثة واحدة بيني وبين شخص آخر (سلسلة رسائل) —
مثل تطبيق واتساب:
- رأس يعرض اسم الطرف الآخر وصورته.
- منطقة الرسائل (الفقاعات) مع سجلات الوقت.
- حقل إرسال رسالة جديدة (Enter للإرسال).
- تحميل تلقائي كل 8 ثوانٍ لاستقبال رسائل جديدة.

لماذا نحتاجه؟
بدون هذا المكوّن لا توجد شاشة عرض/إرسال الرسائل الفعلية.

'use client':
يعمل في المتصفح لأنه يستخدم useState/useEffect
وuseRef (التمرير لآخر رسالة) وfetch.

متى يعمل؟
عند اختيار محادثة في صفحة /messages.

من يستدعي هذا الملف؟
src/components/messages/messages-view.tsx.

الملفات التي يتعامل معها:
- API: /api/messages (GET لجلب الرسائل، POST للإرسال).
- Button، UserAvatar، lucide-react.

ترتيب العمل:
1. عند فتح محادثة: نجلب رسائلها من /api/messages?with=معرف الطرف ↓
2. نعرض الرسائل (رسائلي في جهة، رسائله في جهة أخرى) ↓
3. نكتب رسالة ونرسلها → POST → تظهر فورًا في القائمة ↓
4. كل 8 ثوانٍ نحدّث بدون قفز (silent) لاستقبال الجديد
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (كود بعد العرض)، useRef (عنصر مرجعي للتمرير)،
// useState (حالة متغيرة).
import { useEffect, useRef, useState } from 'react';
// أيقونات: إرسال وسهم رجوع.
import { Send, ChevronRight } from 'lucide-react';
// Button: زر جاهز.
import { Button } from '@/components/ui/button';
// UserAvatar: صورة الطرف الآخر.
import { UserAvatar } from '@/components/ui/user-avatar';

// Message: شكل رسالة واحدة قادمة من الخادم.
type Message = {
  id: string;
  fromId: string; // مَن أرسلها (معرفي أو معرف الطرف الآخر).
  body: string;
  isRead: boolean;
  createdAt: string;
};

// ========================================
// 2. المكوّن الرئيسي: ConversationThread
// ========================================

// ConversationThread: محادثة واحدة كاملة.
// Props:
// - peerId: معرف الطرف الآخر (مَن نتحدث معه).
// - peerName / peerImage: اسمه وصورته للعرض.
// - myId: معرفي لتحديد أي رسالة "لي".
// - onBack: زر الرجوع للقائمة (يُعرض على الجوال فقط).
export function ConversationThread({
  peerId,
  peerName,
  peerImage,
  myId,
  onBack,
}: {
  peerId: string;
  peerName?: string | null;
  peerImage?: string | null;
  myId: string;
  onBack?: () => void;
}) {
  // messages: قائمة رسائل المحادثة.
  const [messages, setMessages] = useState<Message[]>([]);
  // text: النص الذي يكتبه المستخدم حاليًا.
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // error: رسالة الخطأ إن حدث.
  const [error, setError] = useState('');
  // endRef: مرجع إلى آخر عنصر — نمرّر إليه ليظهر آخر رسالة.
  const endRef = useRef<HTMLDivElement>(null);

  // load: جلب رسائل المحادثة.
  // silent = true يعني تحديثًا خلفيًا (بدون قفز الشاشة لآخر رسالة).
  const load = async (silent = false) => {
    try {
      const res = await fetch(`/api/messages?with=${peerId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'تعذّر تحميل المحادثة');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      setError('');
      setLoading(false);
      // التحميل الأول: نمرّر مباشرة إلى آخر رسالة.
      if (!silent) endRef.current?.scrollIntoView({ behavior: 'auto' });
    } catch {
      setError('تعذّر تحميل المحادثة');
      setLoading(false);
    }
  };

  // عند فتح محادثة (تغيّر peerId): نحمّل ثم نحدّث كل 8 ثوانٍ.
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    load();
    const t = setInterval(() => load(true), 8000);
    return () => clearInterval(t); // تنظيف المؤقّت عند إغلاق المحادثة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  // عند وصول رسائل جديدة نمرّر لنهاية المحادثة بسلاسة.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // send: إرسال رسالة مكتوبة.
  async function send() {
    const body = text.trim();
    if (!body || sending) return; // نص فارغ أو إرسال جارٍ → لا تفعل شيئًا.
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: peerId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'تعذّر الإرسال');
        return;
      }
      // نصّف الحقل ونضيف الرسالة الجديدة إلى القائمة فورًا.
      setText('');
      setMessages((m) => [...m, data.message]);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setError('تعذّر الإرسال');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* رأس المحادثة */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="رجوع">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <UserAvatar name={peerName} image={peerImage} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{peerName ?? 'الدكتور'}</p>
        </div>
      </div>

      {/* الرسائل */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">لا توجد رسائل بعد — ابدأ المحادثة.</p>
        ) : (
          // map: فقاعة لكل رسالة.
          messages.map((m) => {
            // mine: هل هذه الرسالة أرسلتها أنا؟
            const mine = m.fromId === myId;
            return (
              // mine → نعرض الرسالة في جهة، والعكس في الأخرى.
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    mine
                      ? 'rounded-tr-sm bg-ocean-600 text-white'
                      : 'rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200'
                  }`}
                >
                  {/* نص الرسالة (نحافظ على الأسطر الجديدة break-words) */}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {/* وقت الإرسال */}
                  <p className={`mt-1 text-[10px] ${mine ? 'text-ocean-100' : 'text-slate-400'}`}>
                    {new Date(m.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* الإرسال */}
      <div className="border-t border-slate-100 p-3">
        {error && <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            // Enter بدون Shift يرسل، وShift+Enter سطر جديد.
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="اكتب رسالتك…"
            className="input min-h-[44px] flex-1 resize-none py-2.5"
          />
          <Button onClick={send} disabled={!text.trim() || sending} className="shrink-0 !px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
