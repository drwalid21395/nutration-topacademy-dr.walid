'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type State = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'off';

/** تحويل مفتاح base64url إلى Uint8Array لمتطلبات pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * زر تفعيل/إلغاء إشعارات الهاتف الحقيقية (web push).
 * يسجّل اشتراك الدفع للمستخدم في PushSubscription ويظهر الإشعار أعلى الهاتف.
 */
export function PushSubscribeButton() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'enabled' : 'off');
    } catch {
      setState('off');
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch('/api/push/public-key');
        if (!res.ok) {
          setState('unsupported');
          return;
        }
        const { publicKey } = await res.json();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState('enabled');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscription?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
        await sub.unsubscribe();
      }
      setState('off');
    } catch {
      // حتى لو فشل الحذف الخادمي، اعرض الحالة الحالية
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;
  if (state === 'unsupported') return null;
  if (state === 'denied') return null;

  if (state === 'enabled') {
    return (
      <Button variant="secondary" size="sm" onClick={disable} disabled={busy}>
        <BellOff className="h-4 w-4" />
        إيقاف إشعارات الهاتف
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={enable} disabled={busy}>
      <BellRing className="h-4 w-4" />
      تفعيل إشعارات الهاتف
    </Button>
  );
}
