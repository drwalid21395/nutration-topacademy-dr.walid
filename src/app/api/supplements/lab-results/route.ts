import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MARKER_AR: Record<string, string> = {
  hemoglobin: 'الهيموجلوبين',
  ferritin: 'فيريتين',
  iron: 'حديد',
  transferrin: 'ترانسفيرين',
  vitaminD: 'فيتامين د (25-OH)',
  b12: 'فيتامين ب12',
  folate: 'حمض الفوليك',
  calcium: 'كالسيوم',
  magnesium: 'مغنيسيوم',
  zinc: 'زنك',
  kidney: 'وظائف كلى',
  liver: 'وظائف كبد',
  thyroid: 'الغدة الدرقية',
  glucose: 'سكر الصائم',
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const labResults = await prisma.labResult.findMany({
    where: { userId: user.id },
    orderBy: { testDate: 'desc' },
  });
  return NextResponse.json({ labResults });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: {
    marker?: string;
    markerAr?: string;
    value?: number;
    unit?: string;
    referenceRange?: string;
    testDate?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.marker || typeof body.value !== 'number' || !body.unit?.trim()) {
    return NextResponse.json({ error: 'التحليل والقيمة والوحدة مطلوبة' }, { status: 422 });
  }

  const labResult = await prisma.labResult.create({
    data: {
      userId: user.id,
      marker: body.marker,
      markerAr: body.markerAr ?? MARKER_AR[body.marker] ?? body.marker,
      value: body.value,
      unit: body.unit.trim(),
      referenceRange: body.referenceRange?.trim() || null,
      testDate: body.testDate ? new Date(body.testDate) : new Date(),
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, labResult }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  const existing = await prisma.labResult.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'التحليل غير موجود' }, { status: 404 });

  await prisma.labResult.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
