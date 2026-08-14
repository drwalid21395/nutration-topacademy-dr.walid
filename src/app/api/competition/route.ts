/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/competition/route.ts

وظيفة الملف:
واجهة API لإدارة البطولات والمسابقات الخاصة بالسباح:
- GET: جلب البطولة النشطة الحالية + أحدث 3 خطط غذائية متعلقة بها.
- POST: إنشاء بطولة جديدة (تلقائيًا تُلغى نشاط البطولات السابقة).
- DELETE: حذف بطولة معيّنة (لمالكها فقط).

لماذا نحتاجه؟
صفحة "موسم البطولات" تتيح للسباح تسجيل بطولته القادمة
فيُنشئ النظام تلقائيًا جدول السباقات والخطط الغذائية المرتبطة.

متى يعمل؟
عند GET/POST/DELETE إلى /api/competition.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (POST) هل أرسل طلبات كثيرة؟ → 429.
3. (POST) نتأكد من وجود ملف السباح → 422 لو لا يوجد.
4. (POST) نقرأ اسم البطولة وتاريخها وننشئها.
5. (DELETE) نحذف البطولة بالمعرّف بعد التأكد أنها تخص المستخدم.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: بيانات ناقصة/تاريخ غير صالح.
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
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';

// ========================================
// 2. معالج الطلب GET (جلب البطولة الحالية)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نجلب البطولة النشطة لهذا المستخدم (الأحدث تاريخًا).
  // findFirst: أول سجل يطابق الشرط (isActive: true).
  const competition = await prisma.competition.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { startDate: 'desc' },
  });

  // الخطوة 3: إن وُجدت بطولة — نجلب أحدث 3 خطط غذائية مرتبطة
  // بمراحل البطولة (تحضير/يوم البطولة/ما بعد البطولة).
  // take: 3: نأخذ ثلاثة خطط فقط. لو لا توجد بطولة → قائمة فارغة.
  const plans = competition
    ? await prisma.mealPlan.findMany({
        where: {
          userId: user.id,
          planType: { in: ['competitionPrep', 'competitionDay', 'postCompetition'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, planType: true, title: true, totalCalories: true, proteinG: true },
      })
    : [];

  return NextResponse.json({ competition, plans });
}

// ========================================
// 3. معالج الطلب POST (إنشاء بطولة)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
// req: كائن الطلب الواصل (يحوي اسم البطولة وتاريخها وموقعها وعدد السباقات).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 20 طلبًا في الدقيقة.
  if (!rateLimit(`comp:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: نتأكد من وجود ملف السباح (البطولة مرتبطة بملف غذائي).
  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: 'أدخل ملف السباح أولًا' }, { status: 422 });

  // الخطوة 4: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  let body: { name?: string; date?: string; location?: string; racesCount?: number };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 5: التأكد من وجود اسم البطولة وتاريخها.
  if (!body.name || !body.date) {
    return NextResponse.json({ error: 'اسم البطولة وتاريخها مطلوبان' }, { status: 422 });
  }

  // تحويل التاريخ النصي إلى كائن Date، والتحقق أنه تاريخ صحيح فعلًا
  // (Number.isNaN(getTime())): لو غير صالح → 422.
  const startDate = new Date(body.date);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 422 });
  }

  // الخطوة 6: إلغاء نشاط كل البطولات السابقة للمستخدم
  // (updateMany: تعديل عدة سجلات معًا) — المستخدم له بطولة نشطة واحدة فقط.
  await prisma.competition.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });

  // الخطوة 7: نُنشئ قائمة السباقات تلقائيًا.
  // Math.min(..., 12): عدد السباقات بحد أقصى 12.
  const races: Record<string, unknown>[] = [];
  for (let i = 0; i < Math.min(body.racesCount ?? 1, 12); i++) {
    races.push({ number: i + 1, name: `سباق ${i + 1}`, time: null });
  }

  // الخطوة 8: حفظ البطولة في جدول Competition.
  // races نخزنها كنص JSON لأن العمود نصي في قاعدة البيانات.
  const competition = await prisma.competition.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      name: body.name,
      startDate,
      location: body.location || null,
      races: JSON.stringify(races),
    },
  });

  // الخطوة 9: تسجيل العملية في سجل التدقيق.
  await audit(user.id, 'competition.create', 'Competition', competition.id, { name: body.name });

  return NextResponse.json({ ok: true, competition });
}

// ========================================
// 4. معالج الطلب DELETE (حذف بطولة)
// ========================================

// export async function DELETE:
// Next.js يستدعي DELETE تلقائيًا عند وصول طلب DELETE لهذا المسار.
// req: كائن الطلب (المعرّف يصل في رابط الاستعلام ?id=).
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // new URL(req.url): نسخة قابلة للقراءة من رابط الطلب.
  // searchParams.get('id'): نقرأ المعرّف من رابط الاستعلام.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  // deleteMany مع شرط userId: يحذف البطولة فقط لو كانت تخص هذا المستخدم
  // (حماية من حذف بطولات الآخرين).
  await prisma.competition.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
