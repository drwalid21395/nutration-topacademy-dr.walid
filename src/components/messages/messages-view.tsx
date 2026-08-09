'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, ChevronLeft } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ConversationThread } from '@/components/messages/conversation-thread';
import { PushSubscribeButton } from '@/components/messages/push-subscribe-button';

type Conversation = {
  id: string;
  name: string | null;
  image: string | null;
  fullName: string | null;
  role: string;
  lastMessage: { id: string; body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
};

function displayName(c: Conversation): string {
  return c.fullName || c.name || (c.role === 'admin' ? 'الدكتور' : 'سباح');
}

export function MessagesView({
  myId,
  myRole,
  initialUserId,
}: {
  myId: string;
  myRole: string;
  initialUserId?: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(initialUserId ?? null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = async () => {
    const res = await fetch('/api/messages/conversations');
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
      if (myRole !== 'admin' && data.conversations?.length > 0) {
        setSelected(data.conversations[0].id);
      } else if (initialUserId) {
        const exists = data.conversations?.some((c: Conversation) => c.id === initialUserId);
        if (exists) setSelected(initialUserId);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = conversations.find((c) => c.id === selected) ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ocean-900">الرسائل</h1>
          <p className="mt-1 text-sm text-slate-500">
            {myRole === 'admin' ? 'تواصل مباشر مع سباحيك.' : 'تواصل مباشر مع الدكتور.'}
          </p>
        </div>
        <PushSubscribeButton />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* قائمة المحادثات */}
        <div className={`lg:block ${mobileOpen ? 'hidden' : 'block'}`}>
          <Card className="overflow-hidden !p-0">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
            ) : conversations.length === 0 ? (
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
              <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setMobileOpen(true);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-ocean-50 ${
                      selected === c.id ? 'bg-ocean-50/70' : ''
                    }`}
                  >
                    <UserAvatar name={displayName(c)} image={c.image} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-slate-800">{displayName(c)}</p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {new Date(c.lastMessage.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500">
                          {c.lastMessage
                            ? `${c.lastMessage.fromMe ? 'أنت: ' : ''}${c.lastMessage.body}`
                            : 'لا توجد رسائل بعد'}
                        </p>
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
              <ConversationThread
                peerId={current.id}
                peerName={displayName(current)}
                peerImage={current.image}
                myId={myId}
                onBack={() => setMobileOpen(false)}
              />
            ) : myRole === 'admin' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <ChevronLeft className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">اختر سباحًا لعرض محادثته.</p>
              </div>
            ) : (
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
