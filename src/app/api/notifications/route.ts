/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/notifications/route.ts

وظيفة الملف:
واجهة API لإشعارات المستخدم داخل التطبيق:
- GET: جلب آخر الإشعارات غير المُتجاهَلة + عدد غير المقروء.
- PATCH: تحديث حالة الإشعارات (قراءة أو تجاهل) —
  إما كل الإشعارات (all) أو مجموعة بمعرّفات (ids).

لماذا نحتاجه؟
الجرس أعلى الصفحة يحتاج قائمة الإشعارات وعدد غير المقروء،
وعند النقر على الإشعار أو تجاهله نحدّث حالته هنا.

متى يعمل؟
عند GET/PATCH إلى /api/notifications.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (GET) نجلب الإشعارات غير المتجاهلة مرتبة من الأحدث.
3. (PATCH) نقرأ الطلب: إن all → نحدّث الكل؛ وإن ids → نحدّث المحددة.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة/لا يوجد معرّف.
- 401: غير مسجل.

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
// 2. معالج الطلب GET (قائمة الإشعارات)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
// يدعم معامل ?limit= لتحديد عدد الإشعارات.
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة عدد الإشعارات المطلوب من الرابط.
  // Math.min(..., 100): حد أقصى 100 مهما طلب المستخدم أكثر.
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  // الخطوة 3: نجلب إشعارات المستخدم غير المتجاهلة، من الأحدث.
  // isDismissed: false = لم يتجاهلها المستخدم بعد.
  const items = await prisma.notification.findMany({
    where: { userId: user.id, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // الخطوة 4: عدد غير المقروء (isRead: false) لعرضه على الجرس.
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false, isDismissed: false } });

  return NextResponse.json({ items, unread });
}

// ========================================
// 3. معالج الطلب PATCH (تحديث الإشعارات)
// ========================================

// export async function PATCH:
// Next.js يستدعي PATCH تلقائيًا عند وصول طلب PATCH لهذا المسار.
// req: كائن الطلب (يحوي ids أو all + action).
// action: 'dismiss' لتجاهل الإشعارات، أو أي شيء آخر = تحديدها كمقروءة.
export async function PATCH(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  let body: { ids?: string[]; all?: boolean; action?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // where: الشرط الأساسي — كل التعديلات على إشعارات هذا المستخدم فقط.
  const where = { userId: user.id };

  // الخطوة 3أ: لو طُلب تحديث الكل (all: true).
  if (body.all) {
    // dismiss → نجعل الجميع متجاهَلًا؛ وإلا → مقروءًا.
    // updateMany: تعديل عدة سجلات دفعة واحدة.
    if (body.action === 'dismiss') {
      await prisma.notification.updateMany({ where, data: { isDismissed: true } });
    } else {
      await prisma.notification.updateMany({ where, data: { isRead: true } });
    }
    return NextResponse.json({ ok: true });
  }

  // الخطوة 3ب: لو أُرسلت قائمة معرّفات — نحدّثها فقط.
  // in: الشرط "المعرّف ضمن هذه القائمة".
  if (Array.isArray(body.ids) && body.ids.length) {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: body.action === 'dismiss' ? { isDismissed: true } : { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  // لا all ولا ids → طلب غير مكتمل → 400.
  return NextResponse.json({ error: 'لا يوجد معرّف' }, { status: 400 });
}
