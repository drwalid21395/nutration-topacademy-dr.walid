// GET /api/safety/status — حالة السلامة الحالية للسبّاح

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLatestVitals, getActiveAlerts } from '@/lib/safety';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const latestVitals = await getLatestVitals(user.id);
  const activeAlerts = await getActiveAlerts(user.id);
  const latestConnection = await prisma.wearableConnection.findFirst({
    where: { userId: user.id, provider: { not: 'manual' } },
    orderBy: { updatedAt: 'desc' },
  });

  const lastUpdate = latestVitals?.timestamp ? new Date(latestVitals.timestamp) : null;
  const agoMs = lastUpdate ? Date.now() - lastUpdate.getTime() : null;
  let lastUpdateAgo = 'لم تصل بيانات بعد';
  if (agoMs != null) {
    if (agoMs < 60_000) lastUpdateAgo = 'منذ قليل';
    else if (agoMs < 3600_000) lastUpdateAgo = `منذ ${Math.round(agoMs / 60000)} دقيقة`;
    else lastUpdateAgo = `منذ ${Math.round(agoMs / 3600000)} ساعة`;
  }

  const watchConnected = latestConnection?.status === 'connected';

  // آخر أحداث السلامة
  const recentEvents = await prisma.safetyEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, eventType: true, severity: true, description: true, createdAt: true },
  });

  return NextResponse.json({
    latestVitals,
    activeAlertsCount: activeAlerts.length,
    activeAlerts,
    lastUpdateAgo,
    watchConnected,
    batteryLevel: latestVitals?.batteryLevel ?? null,
    recentEvents,
  });
}
