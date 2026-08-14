/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/messages/push-subscribe-button.tsx

وظيفة الملف:
زر "تفعيل/إيقاف إشعارات الهاتف" — يستخدم تقنية Web Push
ليجعل المتصفح/الهاتف يعرض إشعارًا حقيقيًا فوق الشاشة
حتى لو المستخدم خارج الموقع.

لماذا نحتاجه؟
إشعارات واتساب/تلغرام تعمل فقط داخل التطبيق.
Web Push يعرض إشعارات نظام (نوافذ منبثقة) عند وصول
رسالة جديدة، وهذه هي الطريقة القياسية للإشعارات على الويب.

'use client':
يعمل في المتصفح لأنه يستخدم navigator (خدمات المتصفح)
والأذونات (Notification) وserviceWorker.

متى يعمل؟
في صفحة الرسائل /messages.

من يستدعي هذا الملف؟
src/components/messages/messages-view.tsx.

الملفات التي يتعامل معها:
- API: /api/push/public-key (مفتاح عام) و/api/push/subscription (حفظ/حذف الاشتراك).
- Button: زر جاهز.
- lucide-react: أيقونات جرس.

مصطلحات مهمة:
- Service Worker: سكربت خلفي يعمل حتى عند إغلاق الصفحة.
- Push Subscription: "اشتراك" فريد يمثل هاتف المستخدم
  عند الخادم — بدونه لا نعرف إلى أين نرسل الإشعار.
- applicationServerKey: مفتاح عام للتشفير بين الخادم والمتصفح.

ترتيب العمل:
1. عند الظهور نفحص دعم المتصفح والأذونات والاشتراك الحالي ↓
2. تفعيل: طلب إذن → تسجيل اشتراك → إرساله للخادم ↓
3. إيقاف: حذف الاشتراك من الخادم وإلغاؤه من المتصفح
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (كود بعد العرض)، useState (حالة متغيرة).
import { useEffect, useState } from 'react';
// أيقونات جرس (تفعيل/إيقاف) من lucide-react.
import { BellRing, BellOff } from 'lucide-react';
// Button: زر جاهز.
import { Button } from '@/components/ui/button';

// حالات الزر الممكنة:
// loading (فحص)، unsupported (المتصفح لا يدعم)،
// denied (المستخدم رفض الإذن)، enabled (مفعّل)، off (متوقف).
type State = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'off';

// ========================================
// 2. دالة مساعدة: urlBase64ToUint8Array
// ========================================

/** تحويل مفتاح base64url إلى Uint8Array لمتطلبات pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // مفتاح الخادم العام يأتي كنص base64url (آمن للروابط).
  // pushManager.subscribe يريد مصفوفة bytes، فنحوّله:
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); // فك تشفير النص إلى bytes خام
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ========================================
// 3. المكوّن الرئيسي: PushSubscribeButton
// ========================================

/**
 * زر تفعيل/إلغاء إشعارات الهاتف الحقيقية (web push).
 * يسجّل اشتراك الدفع للمستخدم في PushSubscription ويظهر الإشعار أعلى الهاتف.
 */
export function PushSubscribeButton() {
  // state: الحالة الحالية للزر (من النوع State أعلاه).
  const [state, setState] = useState<State>('loading');
  // busy: صحيح أثناء عملية التفعيل/الإيقاف (يعطّل الزر).
  const [busy, setBusy] = useState(false);

  // عند أول ظهور: نفحص إمكانية دعم الإشعارات.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // لا يدعم المتصفح service worker أو push → حالة unsupported.
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    // المستخدم رفض الإذن سابقًا → حالة denied.
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    // وإلا نفحص هل لديه اشتراك فعلي من قبل.
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // checkSubscription: هل للمستخدم اشتراك push محفوظ في المتصفح؟
  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'enabled' : 'off');
    } catch {
      setState('off');
    }
  }

  // enable: تفعيل الإشعارات.
  async function enable() {
    setBusy(true);
    try {
      // 1) نطلب إذن الإشعارات من المستخدم (نافذة المتصفح).
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('denied');
        return;
      }
      // 2) نأخذ اشتراكًا إن وُجد أو ننشئ اشتراكًا جديدًا.
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // نجلب المفتاح العام من خادمنا ثم ننشئ الاشتراك به.
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
      // 3) نحفظ الاشتراك في قاعدة بياناتنا حتى نعرف أين نرسل.
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

  // disable: إيقاف الإشعارات.
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // 1) نحذف الاشتراك من قاعدة بياناتنا (باستخدام عنوانه كمعرّف).
        await fetch(`/api/push/subscription?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
        // 2) نلغي الاشتراك من المتصفح نفسه.
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

  // لا نعرض شيئًا في هذه الحالات (لا زر قابل للعرض):
  if (state === 'loading') return null;
  if (state === 'unsupported') return null;
  if (state === 'denied') return null;

  // إن كان مفعّلًا نعرض زر الإيقاف، وإلا زر التفعيل.
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
