import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTodayState } from '@/lib/nutrition/dynamic';

/** حالة التغذية الديناميكية لليوم (لوحة السباح). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const state = await getTodayState(user.id);
  return NextResponse.json(state);
}
