/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/coach/athletes/route.ts

وظيفة الملف:
واجهة API بإجراءات ثلاث:
- GET: قائمة السباحين المرتبطين بالمدرب مع ملخص نشاطهم لآخر 7 أيام.
- POST: إضافة سباح جديد بالبريد الإلكتروني (إنشاء علاقة CoachRelation).
- PATCH: تعديل العلاقة (تفعيل/رفض/تغيير الصلاحيات).

لماذا نحتاجه؟
لوحة المدرب الغذائي تعرض من يتابعهم، وتتيح له إضافة سباحين
وإدارة صلاحيات الإطلاع والتعديل على خططهم.

متى يعمل؟
- عند GET/POST/PATCH إلى /api/coach/athletes.
- مخصص للمدرب (coach) وأخصائي التغذية (dietitian) والأدمن (admin).

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. لو دوره ليس مدربًا/أخصائي/أدمن → 403.
3. (POST) هل أرسل طلبات كثيرة؟ → 429. نقرأ البريد ونضيف السباح.
4. (GET) نجلب العلاقات ونحصي سجلات كل سباح لآخر 7 أيام.
5. (PATCH) نعدّل حالة العلاقة أو صلاحياتها.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 403: ليست لديك صلاحية.
- 404: المستخدم/العلاقة غير موجودة. 422: بيانات ناقصة.
- 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit + audit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول
// ويعيد بيانات المستخدم الحالي (أو null لو غير مسجل).
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. معالج الطلب GET (قائمة السباحين)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  // الخطوة 2: تحقق الدور — المدرب/الأخصائي/الأدمن فقط.
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

  // الخطوة 3: نجلب كل العلاقات التي المستخدم فيها هو المدرب.
  // findMany: كل السجلات المطابقة، مرتبة من الأحدث.
  // include.athlete: نأخذ مع كل علاقة بيانات السباح وملفه الغذائي.
  const relations = await prisma.coachRelation.findMany({
    where: { coachId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      athlete: {
        select: {
          id: true, name: true, email: true, image: true, createdAt: true,
          profiles: { select: { id: true, fullName: true, ageGroup: true, swimmerLevel: true, specialty: true, goal: true } },
        },
      },
    },
  });

  // الخطوة 4: لكل سباح نحسب نشاطه لآخر 7 أيام.
  const athletes = [];
  for (const r of relations) {
    const a = r.athlete;
    // أول ملف غذائي للسباح (المستخدم عادةً يملك ملفًا واحدًا).
    const profile = a.profiles[0];
    // تاريخ قبل 7 أيام من الآن ليكون حدّ العدّ.
    const from = new Date();
    from.setDate(from.getDate() - 7);
    // Promise.all: نجري 4 استعلامات متوازية (أسرع من التسلسل).
    // count: عدد سجلات الطعام/التدريب/الوزن خلال الأسبوع.
    // findFirst: أحدث خطة غذائية للسباح.
    const [food, training, weight, plan] = await Promise.all([
      prisma.foodLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.trainingLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.weightLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.mealPlan.findFirst({ where: { userId: a.id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
    ]);
    // نجمّع بيانات السباح مع عدّادات الأسبوع وخطته.
    athletes.push({ relation: r, athlete: a, profile, logs7d: { food, training, weight }, plan });
  }

  return NextResponse.json({ athletes });
}

// ========================================
// 3. معالج الطلب POST (إضافة سباح)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
// req: كائن الطلب الواصل (يحوي البريد الإلكتروني للسباح الجديد).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول والدور.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

  // الخطوة 2: منع الطلبات الكثيرة — 20 طلبًا في الدقيقة.
  if (!rateLimit(`coach:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.email) return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 422 });

  // الخطوة 4: البحث عن السباح بالبريد (تنظيف المسافات والأحرف الصغيرة).
  const athlete = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!athlete) return NextResponse.json({ error: 'لا يوجد مستخدم بهذا البريد' }, { status: 404 });
  // منع المدرب من إضافة نفسه.
  if (athlete.id === user.id) return NextResponse.json({ error: 'لا يمكنك إضافة نفسك' }, { status: 422 });

  // الخطوة 5: إنشاء العلاقة في جدول CoachRelation.
  // upsert: إن لم تكن موجودة أُنشئها، وإن كانت موجودة لا نعدّل شيئًا (update: {}).
  // update: {} يعني: عند وجودها نتركها كما هي (لا تكرار).
  const relation = await prisma.coachRelation.upsert({
    where: { coachId_athleteId: { coachId: user.id, athleteId: athlete.id } },
    update: {},
    create: { coachId: user.id, athleteId: athlete.id, status: 'active', canViewHealth: true },
  });

  // الخطوة 6: تسجيل العملية في سجل التدقيق.
  await audit(user.id, 'coach.addAthlete', 'CoachRelation', relation.id, { athleteId: athlete.id });

  return NextResponse.json({ ok: true, relation });
}

// ========================================
// 4. معالج الطلب PATCH (تعديل العلاقة)
// ========================================

// export async function PATCH:
// Next.js يستدعي PATCH تلقائيًا عند وصول طلب PATCH لهذا المسار.
// req: كائن الطلب الواصل (يحوي relationId + الإجراء أو الصلاحيات).
export async function PATCH(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول والدور.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

  // الخطوة 2: قراءة جسم الطلب.
  let body: { relationId?: string; action?: string; canEditPlan?: boolean; canViewHealth?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.relationId) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  // الخطوة 3: نتأكد أن العلاقة تخص هذا المدرب فعلًا
  // (where يشمل coachId حتى لا يعدّل مدرب علاقة غيره).
  const where = { id: body.relationId, coachId: user.id };
  const relation = await prisma.coachRelation.findFirst({ where });
  if (!relation) return NextResponse.json({ error: 'العلاقة غير موجودة' }, { status: 404 });

  // الخطوة 4: حسب الإجراء المطلوب:
  // activate: تفعيل العلاقة، reject: رفضها، وإلا: تعديل الصلاحيات.
  if (body.action === 'activate') {
    await prisma.coachRelation.update({ where: { id: relation.id }, data: { status: 'active' } });
  } else if (body.action === 'reject') {
    await prisma.coachRelation.update({ where: { id: relation.id }, data: { status: 'rejected' } });
  } else {
    // ?? تعني: نأخذ القيمة المرسلة، وإن لم تُرسل نحتفظ بالقيمة الحالية.
    await prisma.coachRelation.update({
      where: { id: relation.id },
      data: {
        canEditPlan: body.canEditPlan ?? relation.canEditPlan,
        canViewHealth: body.canViewHealth ?? relation.canViewHealth,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
