import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-user';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { ingestActivity, logSync } from '@/lib/wearables/sync';

/** إدخال نشاط يومي (يدوي أو من جهاز) عبر خط التطبيع الموحّد. */
export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`health:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { provider?: string; activity?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const provider = String(body.provider ?? 'manual');
  const activity = body.activity;
  if (!activity || typeof activity !== 'object') {
    return NextResponse.json({ error: 'بيانات النشاط مطلوبة' }, { status: 422 });
  }

  const started = Date.now();
  try {
    const result = await ingestActivity(user.id, activity, provider);
    await audit(user.id, 'health.activity.ingest', 'DailyActivity', undefined, { provider });
    await logSync(user.id, provider, 'success', 1, result.message, Date.now() - started);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logSync(user.id, provider, 'error', 0, err instanceof Error ? err.message : 'فشل الإدخال', Date.now() - started);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذر الحفظ' }, { status: 500 });
  }
}

/** نشاط اليوم. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activity = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  return NextResponse.json({ activity });
}
