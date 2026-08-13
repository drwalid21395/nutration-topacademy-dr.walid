import { NextRequest, NextResponse } from 'next/server';
import { findDueConnections, runSyncConnection } from '@/lib/wearables/sync';

/**
 * مزامنة دورية لكل المستخدمين — تُستدعى من Vercel Cron كل ١٥ دقيقة.
 * محمية بمفتاح CRON_SECRET في رأس Authorization.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const due = await findDueConnections();
  const results = [];
  for (const conn of due) {
    const r = await runSyncConnection(conn);
    results.push(r);
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
