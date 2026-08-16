// GET /api/safety/alerts — جلب الإنذارات
// POST /api/safety/alerts — تأكيد استلام / حل إنذار

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getActiveAlerts, acknowledgeAlert, resolveAlert } from '@/lib/safety';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const alerts = await getActiveAlerts(user.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.alertId || !body?.action) {
    return NextResponse.json({ error: 'alertId و action مطلوبان' }, { status: 400 });
  }

  if (body.action === 'acknowledge') {
    await acknowledgeAlert(body.alertId, user.id, user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'resolve') {
    await resolveAlert(body.alertId, user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
