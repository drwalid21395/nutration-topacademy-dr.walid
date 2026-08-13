import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PROVIDERS } from '@/lib/wearables/providers';

/** قائمة المزودين المتاحين + اتصالات المستخدم الحالية. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const connections = await prisma.wearableConnection.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const providers = PROVIDERS.map((p) => ({
    ...p,
    connection: connections.find((c) => c.provider === p.id) ?? null,
  }));

  return NextResponse.json({ providers, connections });
}
