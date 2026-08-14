/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/disconnect/route.ts

وظيفة الملف:
واجهة API بحرف POST تفصل اتصال ساعة/مزود عن حساب المستخدم:
تغيّر حالة الاتصال إلى disconnected وتُحذف التوكنات المخزنة
(accessToken/refreshToken) فورًا.

لماذا نحتاجه؟
عندما يريد السباح إيقاف مزامنة ساعته (أو تغيير الجهاز أو
التراجع عن الربط) يجب أن نزيل صلاحية الوصول فورًا بدل ترك
توكنات حية في قاعدتنا.

متى يعمل؟
عند استقبال طلب POST إلى /api/wearables/disconnect.

من يستدعي هذا الملف؟
صفحة «ربط الساعات الذكية» — زر «إلغاء الربط» بجانب الجهاز.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول WearableConnection.
- audit من lib/security.

ترتيب العمل:
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو غير صالح.
3. معرّف الاتصال مطلوب → 422 لو غائب.
4. نبحث عن الاتصال بشرط ملكيته للمستخدم → 404 لو غير موجود.
5. نعطّل الاتصال ونحذف التوكنات.
6. نسجل العملية (audit) ونرجع ok.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب بالجداول.
import { prisma } from '@/lib/prisma';
// audit: دالة محلية من lib/security تسجل العملية في سجل التدقيق.
import { audit } from '@/lib/security';

// ========================================
// 2. معالج إلغاء الربط (POST)
// ========================================

/** إلغاء ربط جهاز — لمالكه فقط. */
// POST: يفصل الاتصال عن المستخدم ويحذف التوكنات.
// «لمالكه فقط»: نبحث دائمًا بشرط userId حتى لا يفصل أحد جهاز غيره.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معرّف الاتصال من جسم الطلب.
  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }
  const connectionId = String(body.connectionId ?? '');
  // الخطوة 3: المعرّف مطلوب → 422 لو غائب أو فارغًا.
  if (!connectionId) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 422 });

  // الخطوة 4: نبحث عن الاتصال بشرط أنه للمستخدم نفسه.
  // لو لا يوجد → 404 (غير موجود).
  const conn = await prisma.wearableConnection.findFirst({ where: { id: connectionId, userId: user.id } });
  if (!conn) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // الخطوة 5: تعطيل الاتصال وحذف التوكنات نهائيًا.
  // accessToken/refreshToken: null — لا نُبقي أي صلاحية نشطة.
  // lastSyncAt: null — ليست هناك مزامنة أخيرة بعد الآن.
  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: { status: 'disconnected', accessToken: null, refreshToken: null, lastSyncAt: null },
  });
  // الخطوة 6: تسجيل العملية في سجل التدقيق ثم إرجاع النجاح.
  await audit(user.id, 'wearable.disconnect', 'WearableConnection', conn.id, { provider: conn.provider });
  return NextResponse.json({ ok: true });
}
