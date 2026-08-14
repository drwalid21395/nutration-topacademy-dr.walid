/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/logs/route.ts

وظيفة الملف:
واجهة API موحّدة للإدخالات اليومية بخمس أنواع:
- POST: إضافة سجل (طعام/ماء/تدريب/استشفاء/وزن) حسب body.type.
- GET: جلب سجلات يوم معيّن أو فترة زمنية حسب النوع.
- DELETE: حذف سجل (لمالكه فقط).
- PATCH: تعديل سجل طعام (لمالكه فقط).

لماذا نحتاجه؟
الصفحات اليومية للسباح (الطعام، الماء، التدريب، الاستشفاء، الوزن)
كلها تتعامل مع هذا الملف الواحد بدل ملف لكل نوع، فيسهل تتبع النشاط.

متى يعمل؟
عند GET/POST/PATCH/DELETE إلى /api/logs.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (POST) هل أرسل طلبات كثيرة؟ → 429.
3. (POST) نقرأ النوع ثم نحفظ السجل في جدول النوع المناسب.
4. (GET) نجلب سجلات اليوم/الفترة حسب النوع.
5. (DELETE) نحذف سجل مالكه فقط. (PATCH) نعدّل سجل طعام مالكه فقط.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 404: السجل غير موجود.
- 422: نوع غير معروف/بيانات ناقصة. 429: طلبات كثيرة.
- 500: فشل في الحفظ.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit + audit من lib/security.
- MEAL_TYPES من lib/constants (أسماء الوجبات الصحيحة).
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
// MEAL_TYPES: من lib/constants — القائمة الصحيحة لأنواع الوجبات
// (فطور/غداء/عشاء...) للتحقق من نوع الوجبة المرسل.
import { MEAL_TYPES } from '@/lib/constants';

// ========================================
// 2. الدوال المساعدة
// ========================================

// parseDate: دالة مساعدة تحوّل التاريخ النصي (YYYY-MM-DD أو نص تاريخ)
// إلى كائن Date؛ فتحفظ السجل في يوم محدد بدقة.
// نضع الساعة 12 ظهرًا لتجنب مشاكل المناطق الزمنية (بداية/نهاية اليوم).
/** تحويل تاريخ (YYYY-MM-DD أو DateTime) إلى Date لحفظ السجل في يوم محدد. */
function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const s = String(v);
  // نمط (regex) يطابق شكل YYYY-MM-DD مثل 2025-01-15.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    // نبنّي التاريخ يدويًا: الشهر يبدأ من 0 في JavaScript لذا نطرح 1.
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return d;
  }
  // إن لم يكن بالصيغة المعروفة، نترك JavaScript يحاول قراءته.
  const d = new Date(s);
  // لو النتيجة "تاريخ غير صالح" → نرجع undefined.
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// toPositiveNum: دالة مساعدة تحوّل أي قيمة إلى رقم عادي
// (أو undefined لو القيمة فارغة/غير رقمية) — تمنع دخول أرقام خاطئة.
/** تحويل قيمة إلى رقم موجب (أو undefined). */
function toPositiveNum(v: unknown): number | undefined {
  const n = v == null ? undefined : Number(v);
  return n == null || Number.isNaN(n) ? undefined : n;
}

// ========================================
// 3. معالج الطلب POST (إضافة سجل)
// ========================================

// export async function POST:
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST إلى /api/logs.
// req: كائن الطلب الواصل (يحوي type + بيانات السجل).
/**
 * سجل موحد للإدخالات اليومية:
 * type: food | water | training | recovery | weight
 */
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 60 طلبًا في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`log:${user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // type: نوع السجل المطلوب (food/water/training/recovery/weight).
  const type = String(body.type ?? '');

  // الخطوة 4: نوزّع حسب النوع عبر switch.
  try {
    switch (type) {
      // 4أ. سجل طعام → جدول FoodLogEntry.
      case 'food': {
        const mealType = body.mealType ? String(body.mealType) : undefined;
        // نتأكد أن نوع الوجبة موجود في القائمة المعروفة MEAL_TYPES.
        if (mealType && !(mealType in MEAL_TYPES)) {
          return NextResponse.json({ error: 'نوع الوجبة غير معروف' }, { status: 422 });
        }
        // نحفظ الوجبة مع قيمها الغذائية (كل رقم يمر عبر toPositiveNum للتنظيف).
        const entry = await prisma.foodLogEntry.create({
          data: {
            userId: user.id,
            date: parseDate(body.date),
            mealType,
            foodName: String(body.foodName ?? 'وجبة'),
            grams: toPositiveNum(body.grams),
            calories: toPositiveNum(body.calories),
            proteinG: toPositiveNum(body.proteinG),
            carbsG: toPositiveNum(body.carbsG),
            fatG: toPositiveNum(body.fatG),
            fiberG: toPositiveNum(body.fiberG),
            sodiumMg: toPositiveNum(body.sodiumMg),
            waterMl: toPositiveNum(body.waterMl),
            source: body.source ? String(body.source) : 'manual',
            note: body.note ? String(body.note) : undefined,
          },
        });
        return NextResponse.json({ ok: true, entry });
      }
      // 4ب. سجل ماء → جدول WaterLogEntry.
      case 'water': {
        const entry = await prisma.waterLogEntry.create({
          data: {
            userId: user.id,
            amountMl: Number(body.amountMl ?? 250), // الافتراضي: كوب 250 مل.
            note: body.note ? String(body.note) : undefined,
          },
        });
        return NextResponse.json({ ok: true, entry });
      }
      // 4ج. سجل تدريب → جدول TrainingLogEntry.
      case 'training': {
        const entry = await prisma.trainingLogEntry.create({
          data: {
            userId: user.id,
            sessionType: String(body.sessionType ?? 'swim'), // الافتراضي: سباحة.
            durationMin: body.durationMin != null ? Number(body.durationMin) : undefined,
            distanceM: body.distanceM != null ? Number(body.distanceM) : undefined,
            intensity: body.intensity ? String(body.intensity) : undefined,
            caloriesBurned: body.caloriesBurned != null ? Number(body.caloriesBurned) : undefined,
            note: body.note ? String(body.note) : undefined,
          },
        });
        return NextResponse.json({ ok: true, entry });
      }
      // 4د. سجل استشفاء → جدول RecoveryLogEntry.
      case 'recovery': {
        const entry = await prisma.recoveryLogEntry.create({
          data: {
            userId: user.id,
            sleepHours: body.sleepHours != null ? Number(body.sleepHours) : undefined,
            energyLevel: body.energyLevel != null ? Number(body.energyLevel) : undefined,
            hungerLevel: body.hungerLevel != null ? Number(body.hungerLevel) : undefined,
            stressLevel: body.stressLevel != null ? Number(body.stressLevel) : undefined,
            recoveryLevel: body.recoveryLevel != null ? Number(body.recoveryLevel) : undefined,
            weightKg: body.weightKg != null ? Number(body.weightKg) : undefined,
            notes: body.notes ? String(body.notes) : undefined,
          },
        });
        // لو أرسل المستخدم وزنه مع الاستشفاء — نحفظه أيضًا في سجل الوزن.
        if (body.weightKg != null) {
          await prisma.weightLogEntry.create({
            data: { userId: user.id, weightKg: Number(body.weightKg) },
          });
        }
        return NextResponse.json({ ok: true, entry });
      }
      // 4هـ. سجل وزن → جدول WeightLogEntry.
      case 'weight': {
        const entry = await prisma.weightLogEntry.create({
          data: { userId: user.id, weightKg: Number(body.weightKg) },
        });
        return NextResponse.json({ ok: true, entry });
      }
      // أي نوع آخر غير معروف → 422.
      default:
        return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });
    }
  } catch (err) {
    // أي خطأ أثناء الحفظ → 500.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'تعذر الحفظ' },
      { status: 500 }
    );
  }
}

// ========================================
// 4. معالج الطلب GET (جلب السجلات)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET إلى /api/logs.
// يدعم معاملين في الرابط: ?date=YYYY-MM-DD لجلب يوم محدد،
// أو ?days=N لجلب آخر N يوم، مع ?type=<النوع>.
/** جلب سجلات اليوم أو فترة حسب النوع (دعم day محدد) */
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معاملات الرابط.
  // new URL(req.url): نسخة قابلة للقراءة من رابط الطلب.
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'food';
  const dayParam = url.searchParams.get('date');

  // الخطوة 3: لو طُلب يوم محدد (صيغة YYYY-MM-DD) — نجلب سجلات ذلك اليوم فقط.
  let from: Date | undefined;
  if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    // نمط (regex): YYYY-MM-DD. نقسّم التاريخ إلى سنة/شهر/يوم.
    const [y, m, d] = dayParam.split('-').map(Number);
    // بداية اليوم: منتصف ليل اليوم المطلوب.
    from = new Date(y, m - 1, d, 0, 0, 0, 0);
    // نهاية اليوم: منتصف ليل اليوم التالي (شرط "أصغر من" lt).
    const to = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    // gte (أكبر من أو يساوي) + lt (أصغر من) = نطاق ذلك اليوم كاملًا.
    const where = { userId: user.id, date: { gte: from, lt: to } };
    // نجلب السجلات من الجدول المناسب حسب النوع.
    switch (type) {
      case 'food':
        return NextResponse.json({ items: await prisma.foodLogEntry.findMany({ where, orderBy: { date: 'desc' } }) });
      case 'water':
        return NextResponse.json({ items: await prisma.waterLogEntry.findMany({ where, orderBy: { date: 'asc' } }) });
      case 'training':
        return NextResponse.json({ items: await prisma.trainingLogEntry.findMany({ where, orderBy: { date: 'desc' } }) });
      case 'recovery':
        return NextResponse.json({ items: await prisma.recoveryLogEntry.findMany({ where, orderBy: { date: 'desc' } }) });
      case 'weight':
        return NextResponse.json({ items: await prisma.weightLogEntry.findMany({ where, orderBy: { date: 'asc' } }) });
      default:
        return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });
    }
  }

  // الخطوة 4: لو لم يُحدد يوم — نجلب آخر N يوم (الافتراضي: يوم واحد).
  const days = Number(url.searchParams.get('days') ?? 1);
  from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0); // نبدأ من منتصف الليل.

  // نجلب السجلات من الجدول المناسب مع ترتيب مناسب لكل نوع.
  switch (type) {
    case 'food':
      return NextResponse.json({
        items: await prisma.foodLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'desc' } }),
      });
    case 'water':
      return NextResponse.json({
        items: await prisma.waterLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
      });
    case 'training':
      return NextResponse.json({
        items: await prisma.trainingLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'desc' } }),
      });
    case 'recovery':
      return NextResponse.json({
        items: await prisma.recoveryLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'desc' } }),
      });
    case 'weight':
      return NextResponse.json({
        items: await prisma.weightLogEntry.findMany({ where: { userId: user.id, date: { gte: from } }, orderBy: { date: 'asc' } }),
      });
    default:
      return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });
  }
}

// ========================================
// 5. معالج الطلب DELETE (حذف سجل)
// ========================================

// export async function DELETE:
// Next.js يستدعي DELETE تلقائيًا عند وصول طلب DELETE إلى /api/logs.
// يستقبل ?type=<النوع>&id=<المعرّف> من رابط الاستعلام.
/** حذف سجل (طعام/ماء/تدريب/استشفاء/وزن) — لمالكه فقط. */
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة النوع والمعرّف من رابط الاستعلام.
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'food';
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  // الخطوة 3: خريطة (Record) تربط كل نوع بجدوله في Prisma واسمه العربي.
  const models: Record<string, { model: unknown; name: string }> = {
    food: { model: prisma.foodLogEntry, name: 'سجل الطعام' },
    water: { model: prisma.waterLogEntry, name: 'سجل الماء' },
    training: { model: prisma.trainingLogEntry, name: 'سجل التدريب' },
    recovery: { model: prisma.recoveryLogEntry, name: 'سجل الاستشفاء' },
    weight: { model: prisma.weightLogEntry, name: 'سجل الوزن' },
  };
  const target = models[type];
  if (!target) return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });

  // الخطوة 4: نتأكد أن السجل موجود ويملكه هذا المستخدم نفسه
  // (where يحوي userId حتى لا يحذف أحد سجل غيره).
  const existing = await (target.model as { findFirst: (a: { where: { id: string; userId: string } }) => Promise<unknown> }).findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // الخطوة 5: الحذف الفعلي من الجدول.
  await (target.model as { delete: (a: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// ========================================
// 6. معالج الطلب PATCH (تعديل سجل طعام)
// ========================================

// export async function PATCH:
// Next.js يستدعي PATCH تلقائيًا عند وصول طلب PATCH إلى /api/logs.
// يستقبل ?id=<المعرّف> من الرابط، والبيانات الجديدة في جسم الطلب.
/** تعديل سجل طعام — لمالكه فقط. */
export async function PATCH(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معرّف السجل من رابط الاستعلام.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  // الخطوة 3: قراءة البيانات الجديدة من جسم الطلب.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: نتأكد أن السجل موجود ويملكه المستخدم (لا تعديل لسجل غيره).
  const existing = await prisma.foodLogEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // التحقق من نوع الوجبة إن أُرسل.
  const mealType = body.mealType ? String(body.mealType) : undefined;
  if (mealType && !(mealType in MEAL_TYPES)) {
    return NextResponse.json({ error: 'نوع الوجبة غير معروف' }, { status: 422 });
  }

  // الخطوة 5: نجهّز كائن التحديث — نُضيف فقط الحقول التي أُرسلت
  // (كل حقل نتحقق أنه ليس undefined، ثم ننظّف قيمه).
  const data: Record<string, unknown> = {
    ...(mealType !== undefined ? { mealType } : {}),
    ...(body.foodName !== undefined ? { foodName: String(body.foodName) } : {}),
    ...(body.grams !== undefined ? { grams: toPositiveNum(body.grams) } : {}),
    ...(body.calories !== undefined ? { calories: toPositiveNum(body.calories) } : {}),
    ...(body.proteinG !== undefined ? { proteinG: toPositiveNum(body.proteinG) } : {}),
    ...(body.carbsG !== undefined ? { carbsG: toPositiveNum(body.carbsG) } : {}),
    ...(body.fatG !== undefined ? { fatG: toPositiveNum(body.fatG) } : {}),
    ...(body.fiberG !== undefined ? { fiberG: toPositiveNum(body.fiberG) } : {}),
    ...(body.waterMl !== undefined ? { waterMl: toPositiveNum(body.waterMl) } : {}),
    ...(body.date !== undefined ? { date: parseDate(body.date) } : {}),
    ...(body.note !== undefined ? { note: body.note ? String(body.note) : null } : {}),
  };

  // الخطوة 6: تطبيق التحديث في جدول FoodLogEntry وإرجاع السجل المعدّل.
  const entry = await prisma.foodLogEntry.update({ where: { id }, data: data as never });
  return NextResponse.json({ ok: true, entry });
}
