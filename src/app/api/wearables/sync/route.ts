import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, audit } from '@/lib/security';
import { decryptText } from '@/lib/crypto';
import { getAdapter } from '@/lib/wearables/adapters';
import { ingestProviderData, logSync } from '@/lib/wearables/sync';
import { recalculateToday } from '@/lib/nutrition/dynamic';

/**
 * مزامنة اتصال مزود.
 * بدون توكن فعّال (أو مزود غير مكوَّن) نعيد حالة واضحة دون بيانات وهمية.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`sync:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const conn = await prisma.wearableConnection.findFirst({
    where: { id: String(body.connectionId ?? ''), userId: user.id, status: 'connected' },
  });
  if (!conn) return NextResponse.json({ error: 'لا يوجد اتصال مفعّل بهذا المزود' }, { status: 404 });

  const started = Date.now();

  if (conn.provider === 'manual') {
    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
    await logSync(user.id, 'manual', 'success', 0, 'الإدخال اليدوي متاح دائمًا.', Date.now() - started);
    await recalculateToday(user.id);
    return NextResponse.json({ ok: true, message: 'جاهز. سجّل نشاطك أو تدريباتك يدويًا.' });
  }

  const token = decryptText(conn.accessToken);
  if (!token) {
    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: { lastSyncError: 'لا يوجد توكن صالح — أعد الربط.', lastSyncAt: new Date() },
    });
    await logSync(user.id, conn.provider, 'error', 0, 'لا يوجد توكن صالح.', Date.now() - started);
    return NextResponse.json({ error: 'لا يوجد توكن صالح — أعد الربط.' }, { status: 400 });
  }

  const adapter = getAdapter(conn.provider);
  const data = await adapter.sync(user.id, token);

  // تمرير البيانات عبر خط التطبيع الموحّد: نشاط → تدريبات → نوم → وزن → إعادة حساب.
  const ingested = await ingestProviderData(user.id, data, conn.provider);

  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });
  await audit(user.id, 'wearable.sync', 'WearableConnection', conn.id, {
    provider: conn.provider,
    items: data.workouts?.length ?? 0,
    ingested: ingested.workoutsUpserted,
  });
  await logSync(user.id, conn.provider, 'success', ingested.workoutsUpserted, ingested.message, Date.now() - started);
  await recalculateToday(user.id);
  return NextResponse.json({ ok: true, message: ingested.message, ingested });
}
