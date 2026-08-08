import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getVapidPublicKey } from '@/lib/push';

/** إرجاع مفتاح VAPID العام لتفعيل اشتراك الدفع في المتصفح. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const key = await getVapidPublicKey();
  if (!key) return NextResponse.json({ error: 'الدفع غير مفعل' }, { status: 503 });

  return NextResponse.json({ publicKey: key });
}
