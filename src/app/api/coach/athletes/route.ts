import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

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

  const athletes = [];
  for (const r of relations) {
    const a = r.athlete;
    const profile = a.profiles[0];
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const [food, training, weight, plan] = await Promise.all([
      prisma.foodLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.trainingLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.weightLogEntry.count({ where: { userId: a.id, date: { gte: from } } }),
      prisma.mealPlan.findFirst({ where: { userId: a.id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
    ]);
    athletes.push({ relation: r, athlete: a, profile, logs7d: { food, training, weight }, plan });
  }

  return NextResponse.json({ athletes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

  if (!rateLimit(`coach:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.email) return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 422 });

  const athlete = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!athlete) return NextResponse.json({ error: 'لا يوجد مستخدم بهذا البريد' }, { status: 404 });
  if (athlete.id === user.id) return NextResponse.json({ error: 'لا يمكنك إضافة نفسك' }, { status: 422 });

  const relation = await prisma.coachRelation.upsert({
    where: { coachId_athleteId: { coachId: user.id, athleteId: athlete.id } },
    update: {},
    create: { coachId: user.id, athleteId: athlete.id, status: 'active', canViewHealth: true },
  });

  await audit(user.id, 'coach.addAthlete', 'CoachRelation', relation.id, { athleteId: athlete.id });

  return NextResponse.json({ ok: true, relation });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (!['coach', 'dietitian', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  }

  let body: { relationId?: string; action?: string; canEditPlan?: boolean; canViewHealth?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.relationId) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  const where = { id: body.relationId, coachId: user.id };
  const relation = await prisma.coachRelation.findFirst({ where });
  if (!relation) return NextResponse.json({ error: 'العلاقة غير موجودة' }, { status: 404 });

  if (body.action === 'activate') {
    await prisma.coachRelation.update({ where: { id: relation.id }, data: { status: 'active' } });
  } else if (body.action === 'reject') {
    await prisma.coachRelation.update({ where: { id: relation.id }, data: { status: 'rejected' } });
  } else {
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
