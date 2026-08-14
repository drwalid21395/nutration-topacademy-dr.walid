/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/nutrition/recalculate/route.ts

وظيفة الملف:
واجهة API بحرف POST تعيد حساب الهدف الغذائي الديناميكي
لليوم (السعرات والمغذيات) بعد أي نشاط أو وجبة جديدة.

لماذا نحتاجه؟
الهدف الغذائي ليس ثابتًا — إذا سجّل السباح تمرينًا يحرق سعرات
أو وجبة زائدة، يتغير الهدف المتبقي؛ هذه الدالة تحدّثه فورًا.

متى يعمل؟
عند وصول طلب POST إلى /api/nutrition/recalculate.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نستدعي recalculateToday لحساب الهدف من جديد.
4. نرجع الهدف المحسوب.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل. 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- rateLimit من lib/security.
- recalculateToday من lib/nutrition/dynamic.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextResponse: أداة Next.js لإرسال الرد. من مكتبة next/server.
// (لا نحتاج NextRequest لأن هذا الطلب لا يستقبل بيانات).
import { NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// rateLimit: ملف محلي من lib/security — منع الطلبات الكثيرة.
import { rateLimit } from '@/lib/security';
// recalculateToday: من lib/nutrition/dynamic — دالة تعيد حساب
// الهدف الغذائي الديناميكي لليوم حسب النشاط المسجل حتى الآن.
import { recalculateToday } from '@/lib/nutrition/dynamic';

// ========================================
// 2. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/nutrition/recalculate.
/** إعادة حساب الهدف الغذائي الديناميكي لليوم (بعد أي نشاط أو وجبة). */
export async function POST() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 20 طلبًا في الدقيقة.
  if (!rateLimit(`recalc:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: إعادة حساب الهدف وإرجاعه للواجهة.
  const target = await recalculateToday(user.id);
  return NextResponse.json({ ok: true, target });
}
