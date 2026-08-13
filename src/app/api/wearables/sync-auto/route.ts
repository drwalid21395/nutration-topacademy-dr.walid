import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findDueConnections, runSyncConnection } from '@/lib/wearables/sync';

/**
 * مزامنة تلقائية عند فتح التطبيق: تُشغَّل من المتصفح بعد تحميل اللوحة
 * للمزامنة المستمرة (غير الحاجبة) لاتصالات الجهاز المستحقة.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const due = await findDueConnections(user.id);
  if (due.length === 0) return NextResponse.json({ ok: true, results: [], message: 'لا مزامنة مستحقة.' });

  const results = [];
  for (const conn of due) {
    const r = await runSyncConnection(conn);
    results.push(r);
  }

  return NextResponse.json({ ok: true, results });
}
