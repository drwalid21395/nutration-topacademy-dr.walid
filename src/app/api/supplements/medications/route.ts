import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const medications = await prisma.medication.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ medications });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: { name?: string; purpose?: string; dosage?: string; frequency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ error: 'اسم الدواء مطلوب' }, { status: 422 });

  const medication = await prisma.medication.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      purpose: body.purpose?.trim() || null,
      dosage: body.dosage?.trim() || null,
      frequency: body.frequency?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, medication }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  const existing = await prisma.medication.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'الدواء غير موجود' }, { status: 404 });

  await prisma.medication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
