import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  const supplements = await prisma.supplement.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
  });
  const acks = user
    ? await prisma.supplementAck.findMany({
        where: { userId: user.id, acknowledgeConsulting: true },
        select: { supplementId: true },
      })
    : [];
  return NextResponse.json({ supplements, ackedIds: acks.map((a) => a.supplementId) });
}

/** إقرار (أو إلغاء) الإقرار بالاستشارة الطبية لمكمل معين */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: { supplementId?: string; ack?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.supplementId) {
    return NextResponse.json({ error: 'المكمل مطلوب' }, { status: 422 });
  }

  const ack = body.ack === false ? false : true;

  const existing = await prisma.supplementAck.findFirst({
    where: { userId: user.id, supplementId: body.supplementId },
  });

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

  return NextResponse.json({ ok: true, acked: ack });
}

/** حذف الإقرار نهائيًا (إلغاء) */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  let supplementId = url.searchParams.get('supplementId');
  if (!supplementId) {
    try {
      const body = await req.json();
      supplementId = body?.supplementId;
    } catch {
      // لا يوجد جسم — يُكتفى بمعامل الاستعلام
    }
  }
  if (!supplementId) {
    return NextResponse.json({ error: 'المكمل مطلوب' }, { status: 422 });
  }

  const existing = await prisma.supplementAck.findFirst({
    where: { userId: user.id, supplementId },
  });
  if (existing) {
    await prisma.supplementAck.delete({ where: { id: existing.id } });
  }

  return NextResponse.json({ ok: true });
}
