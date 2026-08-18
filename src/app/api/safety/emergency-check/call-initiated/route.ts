import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-user';
import { logTimeline } from '@/lib/safety';

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.alertId) {
    return NextResponse.json({ error: 'alertId مطلوب' }, { status: 400 });
  }

  await logTimeline(body.alertId, user.id, 'call_initiated', {
    phone: body.phone ?? null,
    contactName: body.contactName ?? null,
    initiatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
