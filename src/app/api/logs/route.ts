import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';

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
        const entry = await prisma.foodLogEntry.create({
          data: {
            userId: user.id,
            mealType: body.mealType ? String(body.mealType) : undefined,
            foodName: String(body.foodName ?? 'وجبة'),
            grams: body.grams != null ? Number(body.grams) : undefined,
            calories: body.calories != null ? Number(body.calories) : undefined,
            proteinG: body.proteinG != null ? Number(body.proteinG) : undefined,
            carbsG: body.carbsG != null ? Number(body.carbsG) : undefined,
            fatG: body.fatG != null ? Number(body.fatG) : undefined,
            fiberG: body.fiberG != null ? Number(body.fiberG) : undefined,
            sodiumMg: body.sodiumMg != null ? Number(body.sodiumMg) : undefined,
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

/** جلب سجلات اليوم أو أسبوع ماضٍ حسب النوع */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'food';
  const days = Number(url.searchParams.get('days') ?? 1);
  const from = new Date();
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
