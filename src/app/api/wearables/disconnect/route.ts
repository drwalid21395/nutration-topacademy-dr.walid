import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/security';

/** إلغاء ربط جهاز — لمالكه فقط. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  const connectionId = String(body.connectionId ?? '');
  if (!connectionId) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  const conn = await prisma.wearableConnection.findFirst({ where: { id: connectionId, userId: user.id } });
  if (!conn) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: { status: 'disconnected', accessToken: null, refreshToken: null, lastSyncAt: null },
  });
  await audit(user.id, 'wearable.disconnect', 'WearableConnection', conn.id, { provider: conn.provider });
  return NextResponse.json({ ok: true });
}
