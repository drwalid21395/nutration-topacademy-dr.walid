/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/messages/route.ts

وظيفة الملف:
واجهة API للرسائل النصية بين الدكتور والسباحين:
- GET ?with=<userId>: عرض محادثة وقراءة الرسائل الواردة تلقائيًا.
- POST { toUserId, body }: إرسال رسالة جديدة مع إشعار
  داخل التطبيق وإشعار دفع على الهاتف.

لماذا نحتاجه؟
صفحة الرسائل في الموقع تعتمد عليها لعرض المحادثة وإرسال الرسائل،
مع إشعار المستلم فور وصول رسالته.

متى يعمل؟
عند GET/POST إلى /api/messages.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. نتحقق أن الطرفين (دكتور/أدمن ↔ سباح) — غير ذلك → 403.
3. (GET) نجلب آخر 200 رسالة بينهما، ثم نعلّم الواردة كمقروءة.
4. (POST) ننظّف النص (sanitizeText) ونتحقق من طوله، نحفظ الرسالة،
   نسجل العملية (audit)، ثم نرسل الإشعار (notifyUser).

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات ناقصة.
- 401: غير مسجل. 403: لا يمكن فتح هذه المحادثة.
- 404: المستخدم غير موجود. 422: نص فارغ/طويل.
- 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit + audit + sanitizeText من lib/security.
- notifyUser من lib/push (الإشعارات).
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
// rateLimit + audit + sanitizeText: من lib/security — منع الطلبات
// الكثيرة + تسجيل العملية + تنظيف النص من الأكواد الضارة.
import { rateLimit, audit, sanitizeText } from '@/lib/security';
// notifyUser: من lib/push — إرسال إشعار داخل التطبيق ودفع على الهاتف.
import { notifyUser } from '@/lib/push';

// ========================================
// 2. دالة مساعدة (من يسمح له بالتراسل؟)
// ========================================

// canTalk: تحقق أن طرفي المحادثة هما (أدمن/دكتور ↔ سباح) فقط.
// [myRole, theirRole].sort().join('|'): نرتّب الدورين أبجديًا
// ونجمعهما في سلسلة واحدة لنقارنها — بهذا لا يهم من البادئ.
/**
 * الرسائل بين الدكتور والسباحين (محادثة ثنائية مفتوحة).
 * GET  ?with=<userId>  — عرض المحادثة وقراءة الرسائل الواردة
 * POST { toUserId, body } — إرسال رسالة (دكتور↔سباح فقط) مع إشعار داخلي ودفع للهاتف
 */
function canTalk(myRole: string, theirRole: string): boolean {
  const pair = [myRole, theirRole].sort().join('|');
  return pair === 'admin|athlete';
}

// ========================================
// 3. معالج الطلب GET (عرض المحادثة)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET إلى /api/messages
// مع المعرّف في الرابط: ?with=<userId>.
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معرّف الطرف الآخر من رابط الاستعلام.
  const url = new URL(req.url);
  const withId = url.searchParams.get('with');
  if (!withId) return NextResponse.json({ error: 'حدد المستخدم الآخر' }, { status: 400 });

  // الخطوة 3: نجلب بيانات الطرف الآخر ونتأكد أنه موجود ونشط.
  const other = await prisma.user.findUnique({
    where: { id: withId },
    select: { id: true, name: true, image: true, role: true, status: true },
  });
  if (!other || other.status === 'deleted') {
    return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
  }
  // هل يُسمح بفتح محادثة بين هذين الدورين؟
  if (!canTalk(me.role, other.role)) {
    return NextResponse.json({ error: 'لا يمكن فتح هذه المحادثة' }, { status: 403 });
  }

  // الخطوة 4: نجلب الرسائل بين الطرفين (في الاتجاهين).
  // OR: منّي إليه أو منه إليّ. take: 200: آخر 200 رسالة كحد أقصى.
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromId: me.id, toId: withId },
        { fromId: withId, toId: me.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      fromId: true,
      body: true,
      isRead: true,
      createdAt: true,
    },
  });

  // الخطوة 5: نعلّم الرسائل الواردة (منه إليّ) كمقروءة
  // updateMany: تعديل عدة رسائل دفعة واحدة.
  // قراءة الرسائل الواردة
  await prisma.message.updateMany({
    where: { fromId: withId, toId: me.id, isRead: false },
    data: { isRead: true },
  });

  // نرجع بيانات الطرف الآخر + قائمة الرسائل.
  return NextResponse.json({
    other: { id: other.id, name: other.name, image: other.image, role: other.role },
    messages,
  });
}

// ========================================
// 4. معالج الطلب POST (إرسال رسالة)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST إلى /api/messages.
// req: كائن الطلب الواصل (يحوي toUserId + body).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 30 رسالة في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`messages:${me.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  let body: { toUserId?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: تنظيف النص (sanitizeText يزيل الأكواد/النصوص الضارة)
  // وtrim يزيل المسافات الزائدة من البداية والنهاية.
  const toUserId = body.toUserId;
  const text = sanitizeText(body.body ?? '').trim();
  if (!toUserId) return NextResponse.json({ error: 'حدد المستلم' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'اكتب نص الرسالة' }, { status: 422 });
  if (text.length > 2000) return NextResponse.json({ error: 'الرسالة طويلة جدًا' }, { status: 422 });
  // منع إرسال رسالة لنفسك.
  if (toUserId === me.id) return NextResponse.json({ error: 'لا يمكن إرسال رسالة لنفسك' }, { status: 422 });

  // الخطوة 5: نتأكد أن المستلم موجود ونشط، وأن الترسل مسموح بين الدورين.
  const to = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, role: true, status: true, name: true },
  });
  if (!to || to.status === 'deleted') return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
  if (!canTalk(me.role, to.role)) {
    return NextResponse.json({ error: 'الرسائل متاحة بين الدكتور والسباحين فقط' }, { status: 403 });
  }

  // الخطوة 6: حفظ الرسالة في جدول Message.
  const message = await prisma.message.create({
    data: { fromId: me.id, toId: toUserId, body: text },
    select: { id: true, fromId: true, body: true, isRead: true, createdAt: true },
  });

  // الخطوة 7: تسجيل العملية في سجل التدقيق.
  await audit(me.id, 'message.send', 'Message', message.id, { to: toUserId });

  // الخطوة 8: إشعار المستلم — داخل التطبيق + إشعار دفع على الهاتف.
  // إشعار داخل التطبيق + إشعار دفع على الهاتف للمستلم
  await notifyUser(toUserId, {
    type: 'message',
    title: `رسالة جديدة من ${me.name ?? 'الدكتور'}`,
    body: text.slice(0, 120), // أول 120 حرفًا فقط في الإشعار.
    url: '/messages',
  });

  return NextResponse.json({ ok: true, message });
}
