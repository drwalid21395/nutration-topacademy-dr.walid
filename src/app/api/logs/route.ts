import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { MEAL_TYPES } from '@/lib/constants';

/** تحويل تاريخ (YYYY-MM-DD أو DateTime) إلى Date لحفظ السجل في يوم محدد. */
function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** تحويل قيمة إلى رقم موجب (أو undefined). */
function toPositiveNum(v: unknown): number | undefined {
  const n = v == null ? undefined : Number(v);
  return n == null || Number.isNaN(n) ? undefined : n;
}

/**
 * سجل موحد للإدخالات اليومية:
 * type: food | water | training | recovery | weight
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`log:${user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const type = String(body.type ?? '');

  try {
    switch (type) {
      case 'food': {
        const mealType = body.mealType ? String(body.mealType) : undefined;
        if (mealType && !(mealType in MEAL_TYPES)) {
          return NextResponse.json({ error: 'نوع الوجبة غير معروف' }, { status: 422 });
        }
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
      case 'water': {
        const entry = await prisma.waterLogEntry.create({
          data: {
            userId: user.id,
            amountMl: Number(body.amountMl ?? 250),
            note: body.note ? String(body.note) : undefined,
          },
        });
        return NextResponse.json({ ok: true, entry });
      }
      case 'training': {
        const entry = await prisma.trainingLogEntry.create({
          data: {
            userId: user.id,
            sessionType: String(body.sessionType ?? 'swim'),
            durationMin: body.durationMin != null ? Number(body.durationMin) : undefined,
            distanceM: body.distanceM != null ? Number(body.distanceM) : undefined,
            intensity: body.intensity ? String(body.intensity) : undefined,
            caloriesBurned: body.caloriesBurned != null ? Number(body.caloriesBurned) : undefined,
            note: body.note ? String(body.note) : undefined,
          },
        });
        return NextResponse.json({ ok: true, entry });
      }
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
        if (body.weightKg != null) {
          await prisma.weightLogEntry.create({
            data: { userId: user.id, weightKg: Number(body.weightKg) },
          });
        }
        return NextResponse.json({ ok: true, entry });
      }
      case 'weight': {
        const entry = await prisma.weightLogEntry.create({
          data: { userId: user.id, weightKg: Number(body.weightKg) },
        });
        return NextResponse.json({ ok: true, entry });
      }
      default:
        return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'تعذر الحفظ' },
      { status: 500 }
    );
  }
}

/** جلب سجلات اليوم أو فترة حسب النوع (دعم day محدد) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'food';
  const dayParam = url.searchParams.get('date');

  let from: Date | undefined;
  if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    const [y, m, d] = dayParam.split('-').map(Number);
    from = new Date(y, m - 1, d, 0, 0, 0, 0);
    const to = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    const where = { userId: user.id, date: { gte: from, lt: to } };
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

  const days = Number(url.searchParams.get('days') ?? 1);
  from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

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

/** حذف سجل (طعام/ماء/تدريب/استشفاء/وزن) — لمالكه فقط. */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'food';
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  const models: Record<string, { model: unknown; name: string }> = {
    food: { model: prisma.foodLogEntry, name: 'سجل الطعام' },
    water: { model: prisma.waterLogEntry, name: 'سجل الماء' },
    training: { model: prisma.trainingLogEntry, name: 'سجل التدريب' },
    recovery: { model: prisma.recoveryLogEntry, name: 'سجل الاستشفاء' },
    weight: { model: prisma.weightLogEntry, name: 'سجل الوزن' },
  };
  const target = models[type];
  if (!target) return NextResponse.json({ error: 'نوع غير معروف' }, { status: 422 });

  const existing = await (target.model as { findFirst: (a: { where: { id: string; userId: string } }) => Promise<unknown> }).findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  await (target.model as { delete: (a: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/** تعديل سجل طعام — لمالكه فقط. */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const existing = await prisma.foodLogEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  const mealType = body.mealType ? String(body.mealType) : undefined;
  if (mealType && !(mealType in MEAL_TYPES)) {
    return NextResponse.json({ error: 'نوع الوجبة غير معروف' }, { status: 422 });
  }

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

  const entry = await prisma.foodLogEntry.update({ where: { id }, data: data as never });
  return NextResponse.json({ ok: true, entry });
}
