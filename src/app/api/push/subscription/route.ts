/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/push/subscription/route.ts

وظيفة الملف:
واجهة API لإدارة اشتراك إشعارات الدفع في المتصفح:
- POST: تسجيل/تحديث اشتراك المتصفح في جدول PushSubscription.
- DELETE ?endpoint=...: إلغاء الاشتراك.

لماذا نحتاجه؟
عندما يوافق المستخدم على إشعارات الدفع، يرسل المتصفح
اشتراكه هنا ليحفظه الخادم ويعرف لاحقًا إلى أي متصفح
يرسل الإشعارات (مثل رسالة جديدة من الدكتور).

متى يعمل؟
عند POST/DELETE إلى /api/push/subscription.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (POST) نقرأ بيانات الاشتراك (endpoint + مفتاحان) ونتحقق من اكتمالها → 422.
3. (POST) نحذف أي اشتراك قديم بنفس النقطة ثم نحفظ الجديد.
4. (DELETE) نحذف الاشتراك بعد التأكد أنه يخص المستخدم.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات ناقصة (بدون endpoint).
- 401: غير مسجل. 422: بيانات الاشتراك ناقصة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. معالج الطلب POST (تسجيل الاشتراك)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
// req: كائن الطلب الواصل (يحوي الاشتراك كاملًا).
/**
 * إدارة اشتراك الدفع للمتصفح:
 * POST { subscription: { endpoint, keys: { p256dh, auth } } } — تسجيل/تحديث الاشتراك
 * DELETE ?endpoint=<endpoint> — إلغاء الاشتراك
 */
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب (JSON).
  // الاشتراك يحوي endpoint (عنوان المتصفح) ومفتاحين للتشفير:
  // p256dh + auth.
  let input: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    input = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: استخراج الحقول الثلاثة من الاشتراك.
  const sub = input?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  // لو أي حقل ناقص → 422 (لا يمكننا إرسال إشعارات بدونه).
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'بيانات الاشتراك ناقصة' }, { status: 422 });
  }

  // الخطوة 4: الحفظ — نبدأ بحذف أي اشتراك قديم بنفس العنوان
  // إعادة الاستخدام: نفس النقطة تُستبدل لنفس المستخدم
  // (deleteMany: حذف كل السجلات بنفس النقطة لتجنب التكرار).
  await prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
  // ثم ننشئ الاشتراك الجديد في جدول PushSubscription.
  // userAgent: نوع المتصفح (أول 300 حرف فقط) كبيانات إضافية.
  await prisma.pushSubscription.create({
    data: {
      userId: me.id,
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

// ========================================
// 3. معالج الطلب DELETE (إلغاء الاشتراك)
// ========================================

// export async function DELETE:
// Next.js يستدعي DELETE تلقائيًا عند وصول طلب DELETE لهذا المسار.
// المعرّف يصل في رابط الاستعلام: ?endpoint=<العنوان>.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة عنوان الاشتراك من رابط الاستعلام.
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'حدد نقطة الاشتراك' }, { status: 400 });

  // الخطوة 3: الحذف بشرطين — العنوان + المستخدم (لا حذف اشتراكات الآخرين).
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
  return NextResponse.json({ ok: true });
}
