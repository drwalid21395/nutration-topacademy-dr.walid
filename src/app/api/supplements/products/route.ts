import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const products = await prisma.supplementProduct.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: {
    name?: string;
    brand?: string;
    ingredients?: { name: string; amount: number; unit: string }[];
    batchNumber?: string;
    batchVerified?: boolean;
    thirdPartyTested?: boolean;
    dopingRisk?: string;
    expiryDate?: string | null;
    dailyDose?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 422 });

  const product = await prisma.supplementProduct.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      brand: body.brand?.trim() || null,
      ingredientsJson: body.ingredients?.length ? JSON.stringify(body.ingredients) : null,
      batchNumber: body.batchNumber?.trim() || null,
      batchVerified: body.batchVerified ?? false,
      thirdPartyTested: body.thirdPartyTested ?? false,
      dopingRisk: body.dopingRisk || 'unknown',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      dailyDose: body.dailyDose || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ ok: true, product }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  const existing = await prisma.supplementProduct.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

  await prisma.supplementProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
