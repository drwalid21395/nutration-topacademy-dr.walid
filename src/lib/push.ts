/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/push.ts

وظيفة الملف:
إرسال الإشعارات من نوعين:
1) إشعار دفع حقيقي (PWA) يظهر أعلى شاشة الهاتف حتى لو كان
   التطبيق مغلقًا — عبر مكتبة web-push.
2) إشعار داخلي يُحفظ في قاعدة البيانات ويظهر في "جرس التنبيهات".

لماذا نحتاجه؟
ليصل للمستخدم تذكير أو رسالة جديدة (من مختصه) مباشرة دون أن
يفتح الموقع. البنية التحتية PWA تتيح هذه الرسائل مجانًا.

متى يعمل؟
عند وصول رسالة جديدة أو أي حدث يستدعي notifyUser.

من يستدعيه؟
واجهات API الخاصة بالرسائل والتنبيهات (عند إرسال رسالة،
تذكير، تحديث خطة...).

الملفات التي يتعامل معها:
- src/lib/prisma.ts: قراءة اشتراكات الدفع وإنشاء الإشعارات الداخلية.
- web-push: مكتبة خارجية (node_modules) تتواصل مع خوادم
  الدفع (FCM/Web Push) الخاصة بالمتصفحات.

ترتيب العمل:
notifyUser → حفظ إشعار داخلي → sendPushToUser → إرسال لكل
اشتراكات المستخدم → حذف الاشتراكات المنتهية (404/410)
=================================================
*/

/**
 * إشعارات الدفع (PWA) + الإشعارات داخل التطبيق.
 * إرسال رسالة دفع عبر web-push إلى اشتراكات المستخدم،
 * وإنشاء إشعار داخلي (جرس التنبيهات) — تُستدعى عند وصول رسالة جديدة.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// webpush: مكتبة خارجية (node_modules) — ترسل إشعارات الدفع
// إلى اشتراكات PWA عبر بروتوكول Web Push.
import webpush from 'web-push';

// prisma: من ملف محلي (src/lib/prisma.ts) — الاتصال بقاعدة البيانات
// لقراءة اشتراكات المستخدم وإنشاء الإشعارات الداخلية.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. إعدادات VAPID (مفاتيح الدفع)
// ========================================

// VAPID: مفتاحان (عام وخاص) يثبتان لمتصفحات المستخدمين أن
// الإشعارات تأتي من موقعنا الحقيقي وليس من مزيف.

/*
-----------------------------------------
الدالة: hasVapid (مصدَّرة)
-----------------------------------------
وظيفتها: هل المفاتيح موجودة في البيئة؟
Output: true عندما يتوفر المفتاحان العام والخاص معًا.
-----------------------------------------
*/
export function hasVapid(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

/*
-----------------------------------------
الدالة: getVapidSubject (مصدَّرة)
-----------------------------------------
وظيفتها: البريد الذي "يوقّع" به الطلب عند إرسال الإشعارات.
Output: قيمة من البيئة أو بريدًا افتراضيًا للمشروع.
-----------------------------------------
*/
export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? 'mailto:drwalid21395@users.noreply.github.com';
}

/*
-----------------------------------------
الدالة: getVapidPublicKey (مصدَّرة)
-----------------------------------------
وظيفتها: إرجاع المفتاح العام لتسليمه للمتصفح حتى يشترك
         في الدفع (أو null إن لم يتوفر).
Output: نص المفتاح العام أو null.
-----------------------------------------
*/
export async function getVapidPublicKey(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

// ========================================
// 3. دوال الإرسال
// ========================================

/*
-----------------------------------------
الدالة: sendPushToUser (مصدَّرة)
-----------------------------------------
وظيفتها: إرسال إشعار دفع حقيقي (يظهر أعلى شاشة الهاتف)
         لكل أجهزة المستخدم المسجَّلة.
Input: userId + { title, body, url }.
Processing: إن لم توجد مفاتيح VAPID نعود فورًا؛ ثم نجلب كل
            اشتراكات المستخدم ونرسل لكل اشتراك الرسالة بالتوازي.
            الاشتراكات المرفوضة بسبب انتهائها (404/410) تُحذف.
Output: لا شيء (void) — أي فشل يُتجاهل ولا يكسر الطلب الأصلي.
يستدعيها: notifyUser (داخل الملف) أو واجهات API مباشرة.
ماذا تستدعي: prisma + webpush.
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: notifyUser (مصدَّرة)
-----------------------------------------
وظيفتها: إنشاء إشعار داخل التطبيق (يظهر في جرس التنبيهات)
         + إرسال إشعار دفع حقيقي للهاتف إن أمكن.
Input: userId + { type?, title, body, url? }.
Processing: نحفظ سجلًا جديدًا في جدول الإشعارات (قناة inapp)
            ثم نستدعي sendPushToUser لإشعار الهاتف.
Output: void — فشل الحفظ لا يكسر سير العمل.
يستدعيها: واجهات API عند وصول رسالة/تذكير/تحديث خطة.
ماذا تستدعي: prisma + sendPushToUser (في نفس الملف).
-----------------------------------------
*/
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
