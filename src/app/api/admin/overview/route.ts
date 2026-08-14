/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/admin/overview/route.ts

وظيفة الملف:
واجهة API للوحة إدارة الدكتور (الأدمن):
- GET: إحصائيات شاملة (عدد المستخدمين، الخطط، السجلات،
  البطولات) + آخر 20 مستخدمًا + آخر 10 عمليات تدقيق + صفحات المحتوى.
- PATCH: تعديل حالة/دور مستخدم (تفعيل أو تعليق أو تغيير الدور).

لماذا نحتاجه؟
صفحة لوحة التحكم الرئيسية للأدمن تعرض أرقامًا عامة وحديثة
عن التطبيق، وتتيح إدارة حسابات السباحين.

متى يعمل؟
عند GET/PATCH إلى /api/admin/overview — للأدمن فقط.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401، ولو ليس أدمن → 403.
2. (GET) نجلب 10 عدّادات واستعلامات بالتوازي (Promise.all).
3. (GET) نبني stats + users + recentAudit + contentPages.
4. (PATCH) نقرأ المستخدم المطلوب، نتحقق أنه ليس الأدمن نفسه،
   ونحدّث الحالة/الدور بالقيم المسموحة فقط.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 403: ليست لديك صلاحية. 422: بيانات ناقصة.

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
// 2. معالج الطلب GET (الإحصائيات)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول + أن المستخدم أدمن.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  // الخطوة 2: جلب كل الإحصائيات بالتوازي.
  // Promise.all: يشغّل 10 استعلامات معًا (أسرع من التسلسل).
  // count: عدّ سجلات. groupBy: عدّ مجمّعًا حسب الدور (role).
  // findMany: آخر السجلات (take) مع حقول مختارة (select).
  const [
    totalUsers,
    byRole,
    totalPlans,
    activePlans,
    totalFoodLogs,
    totalTrainings,
    totalCompetitions,
    users,
    recentAudit,
    contentPages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.mealPlan.count(),
    prisma.mealPlan.count({ where: { isActive: true } }),
    prisma.foodLogEntry.count(),
    prisma.trainingLogEntry.count(),
    prisma.competition.count(),
    // آخر 20 مستخدمًا (لجدول حديث لوحة التحكم).
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    }),
    // آخر 10 عمليات تدقيق (audit).
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { email: true } } } }),
    prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } }),
  ]);

  // الخطوة 3: بناء الرد.
  // Object.fromEntries: نحول قائمة (دور ← عدد) إلى كائن:
  // { athlete: 5, admin: 1, ... } ليسهل عرضه في الواجهة.
  return NextResponse.json({
    stats: {
      totalUsers,
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
      totalPlans,
      activePlans,
      totalFoodLogs,
      totalTrainings,
      totalCompetitions,
    },
    users,
    recentAudit,
    contentPages,
  });
}

// ========================================
// 3. معالج الطلب PATCH (إدارة المستخدم)
// ========================================

// export async function PATCH:
// Next.js يستدعي PATCH تلقائيًا عند وصول طلب PATCH لهذا المسار.
// req: كائن الطلب الواصل (يحوي userId + status/role).
export async function PATCH(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول + أن المستخدم أدمن.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  // الخطوة 2: قراءة جسم الطلب (JSON).
  let body: { userId?: string; status?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: 'المستخدم مطلوب' }, { status: 422 });
  // منع الأدمن من تعديل حسابه عبر هذه النقطة (حماية من تعليق نفسه).
  if (body.userId === user.id) return NextResponse.json({ error: 'لا يمكنك تعديل حسابك من هنا' }, { status: 422 });

  // الخطوة 3: نبني كائن التحديث بالقيم المسموحة فقط
  // (includes يرفض أي قيمة غير موجودة في القائمة البيضاء).
  const data: { status?: string; role?: string } = {};
  if (body.status && ['active', 'suspended'].includes(body.status)) data.status = body.status;
  if (body.role && ['athlete', 'guardian', 'coach', 'dietitian', 'admin'].includes(body.role)) data.role = body.role;

  // الخطوة 4: تطبيق التحديث على جدول User.
  await prisma.user.update({ where: { id: body.userId }, data });
  return NextResponse.json({ ok: true });
}
