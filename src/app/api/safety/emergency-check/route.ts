import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-user';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function check(userId: string) {
  const settings = await prisma.safetySettings.findUnique({ where: { userId } });
  if (!settings?.enabled || !settings.autoCallEmergency) {
    return NextResponse.json({ shouldCall: false });
  }

  const unacknowledged = await prisma.safetyAlert.findFirst({
    where: {
      userId,
      level: 'critical',
      acknowledged: false,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!unacknowledged) {
    return NextResponse.json({ shouldCall: false });
  }

  const primaryContact = await prisma.emergencyContact.findFirst({
    where: { userId, isActive: true, notifyOnCritical: true },
    orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
  });

  if (!primaryContact) {
    return NextResponse.json({ shouldCall: false, reason: 'no_contacts' });
  }

  const timeline = await prisma.emergencyTimeline.findFirst({
    where: { alertId: unacknowledged.id, action: 'call_initiated' },
  });
  if (timeline) {
    return NextResponse.json({ shouldCall: false, reason: 'already_called' });
  }

  return NextResponse.json({
    shouldCall: true,
    alertId: unacknowledged.id,
    phone: primaryContact.phone,
    contactName: primaryContact.name,
    message: unacknowledged.message,
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  return check(user.id);
}

export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  return check(user.id);
}
