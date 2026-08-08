'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';

type Message = {
  id: string;
  fromId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

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
      if (!silent) endRef.current?.scrollIntoView({ behavior: 'auto' });
    } catch {
      setError('تعذّر تحميل المحادثة');
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    load();
    const t = setInterval(() => load(true), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
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
          messages.map((m) => {
            const mine = m.fromId === myId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    mine
                      ? 'rounded-tr-sm bg-ocean-600 text-white'
                      : 'rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
