import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/security';
import { recalculateToday } from '@/lib/nutrition/dynamic';

/** إعادة حساب الهدف الغذائي الديناميكي لليوم (بعد أي نشاط أو وجبة). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  if (!rateLimit(`recalc:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  const target = await recalculateToday(user.id);
  return NextResponse.json({ ok: true, target });
}
