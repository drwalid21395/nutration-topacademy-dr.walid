import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

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
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { email: true } } } }),
    prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } }),
  ]);

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

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  let body: { userId?: string; status?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: 'المستخدم مطلوب' }, { status: 422 });
  if (body.userId === user.id) return NextResponse.json({ error: 'لا يمكنك تعديل حسابك من هنا' }, { status: 422 });

  const data: { status?: string; role?: string } = {};
  if (body.status && ['active', 'suspended'].includes(body.status)) data.status = body.status;
  if (body.role && ['athlete', 'guardian', 'coach', 'dietitian', 'admin'].includes(body.role)) data.role = body.role;

  await prisma.user.update({ where: { id: body.userId }, data });
  return NextResponse.json({ ok: true });
}
