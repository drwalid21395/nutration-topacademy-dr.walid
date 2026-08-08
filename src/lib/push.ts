/**
 * إشعارات الدفع (PWA) + الإشعارات داخل التطبيق.
 * إرسال رسالة دفع عبر web-push إلى اشتراكات المستخدم،
 * وإنشاء إشعار داخلي (جرس التنبيهات) — تُستدعى عند وصول رسالة جديدة.
 */
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

export function hasVapid(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? 'mailto:drwalid21395@users.noreply.github.com';
}

export async function getVapidPublicKey(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/** إرسال إشعار دفع حقيقي (يظهر أعلى شاشة الهاتف) لكل أجهزة المستخدم. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!hasVapid()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;
    webpush.setVapidDetails(getVapidSubject(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const data = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? '/messages' });
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data)
      )
    );
    // حذف الاشتراكات المنتهية
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          prisma.pushSubscription.deleteMany({ where: { endpoint: subs[i].endpoint } }).catch(() => {});
        }
      }
    });
  } catch {
    // الدفع اختياري — أي فشل لا يعطل الطلب الأصلي
  }
}

/** إشعار داخل التطبيق (جرس التنبيهات) مع دفع حقيقي للهاتف. */
export async function notifyUser(
  userId: string,
  data: { type?: string; title: string; body: string; url?: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: data.type ?? 'system',
        title: data.title,
        body: data.body,
        channel: 'inapp',
      },
    });
  } catch {
    // الإشعار الداخلي اختياري
  }
  await sendPushToUser(userId, { title: data.title, body: data.body, url: data.url });
}
