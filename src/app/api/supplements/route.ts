/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/route.ts

وظيفة الملف:
واجهة API الرئيسية للمكملات الغذائية:
- GET: قراءة قائمة المكملات النشطة في النظام + أي المكملات
  التي أقرّ المستخدم أنه يستشير الطبيب قبل استخدامها.
- POST: تسجيل (أو إلغاء) «إقرار الاستشارة الطبية» لمكمل معيّن.
- DELETE: إلغاء هذا الإقرار نهائيًا.

لماذا نحتاجه؟
المكملات ليست أدوية — وبعضها غير آمن للقاصّرين أو لمرضى.
لذلك قبل أن يظهر للمستخدم مكمل يجب عليه «الإقرار» بأنه
سيتشاور مع الطبيب. هذا الملف يدير هذه الإقرارات.

متى يعمل؟
عند طلبات GET/POST/DELETE إلى /api/supplements.

من يستدعي هذا الملف؟
صفحة المكملات (قائمة المكملات + مربعات الإقرار الطبي).

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدولا Supplement (المكملات المرجعية)
  و SupplementAck (إقرارات المستخدمين).

ترتيب العمل (GET):
1. نجلب المكملات النشطة (isActive) مرتبة.
2. لو المستخدم مسجل → نجلب إقراراته النشطة لمعرفة ما أقرّه.
3. نرجع المكملات + قائمة معرّفات المكملات المُقَرَّ بها.

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو غير صالح. لا يوجد supplementId → 422.
3. نحدد ack (true/false) ونحدّث الإقرار أو ننشئه.
4. نرجع الحالة الجديدة.

ترتيب العمل (DELETE):
1. غير مسجل → 401.
2. نقرأ supplementId من الرابط أو من جسم الطلب → 422 لو غائب.
3. نحذف الإقرار إن وُجد ونرجع ok.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب به الجداول.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. معالج القراءة (GET)
// ========================================

// GET: قائمة المكملات النشطة + إقرارات المستخدم.
// ملاحظة: getCurrentUser هنا استدعاء اختياري — لو المستخدم
// غير مسجل نرجع المكملات فقط دون أخطاء (acks تصبح قائمة فارغة).
export async function GET() {
  // الخطوة 1: نعرف من المستخدم (إن وُجد).
  const user = await getCurrentUser();
  // الخطوة 2: جلب المكملات النشطة فقط (isActive: true)،
  // مرتبة حسب sortOrder ثم الاسم العربي أبجديًا.
  const supplements = await prisma.supplement.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
  });
  // الخطوة 3: لو المستخدم مسجل → نجلب معرّفات المكملات التي
  // أقرّ فيها بالاستشارة الطبية (acknowledgeConsulting: true).
  // select: نأخذ عمودًا واحدًا فقط لخفة الاستجابة.
  const acks = user
    ? await prisma.supplementAck.findMany({
        where: { userId: user.id, acknowledgeConsulting: true },
        select: { supplementId: true },
      })
    : [];
  // الخطوة 4: نرجع المكملات + قائمة المعرّفات المقَرَّ بها.
  // map: نستخرج معرّفات المكملات من سجلات الإقرار.
  return NextResponse.json({ supplements, ackedIds: acks.map((a) => a.supplementId) });
}

// ========================================
// 3. معالج الإقرار (POST)
// ========================================

/** إقرار (أو إلغاء) الإقرار بالاستشارة الطبية لمكمل معين */
// POST: تسجيل إقرار المستخدم أنه سيستشير الطبيب قبل استخدام
// مكمل معيّن، أو إلغاء هذا الإقرار (ack: false).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // supplementId: المكمل. ack: هل يقرّ الآن أم يلغي الإقرار؟
  let body: { supplementId?: string; ack?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: لابد من معرّف المكمل → 422 لو غائب.
  if (!body.supplementId) {
    return NextResponse.json({ error: 'المكمل مطلوب' }, { status: 422 });
  }

  // الخطوة 4: نحدد قيمة الإقرار النهائية.
  // الافتراضي true (إقرار) إلا لو أُرسل ack: false صراحةً.
  const ack = body.ack === false ? false : true;

  // الخطوة 5: هل يوجد إقرار سابق لهذا المستخدم والمكمل؟
  const existing = await prisma.supplementAck.findFirst({
    where: { userId: user.id, supplementId: body.supplementId },
  });

  // لو وُجد → نحدّث قيمته. ولو لم يوجد والإقرار نشط → ننشئ جديدًا.
  // (لو لم يوجد و ack = false فلا نفعل شيئًا — لا إقرار حتى نلغيه.)
  if (existing) {
    await prisma.supplementAck.update({
      where: { id: existing.id },
      data: { acknowledgeConsulting: ack },
    });
  } else if (ack) {
    await prisma.supplementAck.create({
      data: { userId: user.id, supplementId: body.supplementId, acknowledgeConsulting: true },
    });
  }

  // الخطوة 6: نرجع الحالة النهائية.
  return NextResponse.json({ ok: true, acked: ack });
}

// ========================================
// 4. معالج حذف الإقرار (DELETE)
// ========================================

/** حذف الإقرار نهائيًا (إلغاء) */
// DELETE: حذف سجل الإقرار بالكامل من قاعدة البيانات.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معرّف المكمل — من الرابط أولًا.
  const url = new URL(req.url);
  let supplementId = url.searchParams.get('supplementId');
  // لو لم يوجد في الرابط → نجربه من جسم الطلب.
  // (بعض العملاء يرسلون المعرف في الجسم بدل الرابط.)
  if (!supplementId) {
    try {
      const body = await req.json();
      supplementId = body?.supplementId;
    } catch {
      // لا يوجد جسم — يُكتفى بمعامل الاستعلام
    }
  }
  // الخطوة 3: لو المعرف غائب في المكانين → 422.
  if (!supplementId) {
    return NextResponse.json({ error: 'المكمل مطلوب' }, { status: 422 });
  }

  // الخطوة 4: نبحث عن الإقرار بشرط ملكيته للمستخدم.
  const existing = await prisma.supplementAck.findFirst({
    where: { userId: user.id, supplementId },
  });
  // الخطوة 5: لو وُجد نحذفه، ولو لا يوجد فلا مشكلة — نرجع نجاحًا.
  if (existing) {
    await prisma.supplementAck.delete({ where: { id: existing.id } });
  }

  return NextResponse.json({ ok: true });
}
