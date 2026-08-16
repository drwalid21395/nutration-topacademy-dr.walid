// GET /api/safety/timeline — جلب الخط الزمني للأحداث

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTimeline, getUserTimeline } from '@/lib/safety';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const url = new URL(req.url);
  const alertId = url.searchParams.get('alertId');

  if (alertId) {
    const events = await getTimeline(alertId);
    return NextResponse.json({ events });
  }

  // جلب آخر أحداث المستخدم
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const events = await getUserTimeline(user.id, limit);
  return NextResponse.json({ events });
}
