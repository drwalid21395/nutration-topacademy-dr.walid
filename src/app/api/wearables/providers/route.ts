/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/providers/route.ts

وظيفة الملف:
واجهة API بحرف GET تعيد قائمة «مزودي الساعات» المعروفة في
النظام (Fitbit, Garmin, Polar, Oura, Strava, Apple Health,
Health Connect...) مع حالة كل واحد منها، مرفقة بالاتصالات
الحالية للمستخدم (هل هو مربوط بمزود؟).

لماذا نحتاجه؟
صفحة «ربط الساعات الذكية» تحتاج أن تعرض: أي مزود متاح الآن،
أيها «قريبًا»، وأيها مربوط بالفعل بحساب المستخدم. هذا الملف
يوفر كل ذلك في استجابة واحدة.

متى يعمل؟
عند استقبال طلب GET إلى /api/wearables/providers
(عادة عند فتح صفحة الساعات الذكية).

من يستدعي هذا الملف؟
صفحة «ربط الساعات الذكية».

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول WearableConnection.
- PROVIDERS من lib/wearables/providers (السجل الثابت للمزودين).

ترتيب العمل:
1. غير مسجل → 401.
2. نجلب اتصالات المستخدم الحالية.
3. ندمج كل مزود مع اتصاله (إن وُجد) عبر map.
4. نرجع المزودين والاتصالات.
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
// prisma: عميل قاعدة البيانات (محلي) — نقرأ به الجداول.
import { prisma } from '@/lib/prisma';
// PROVIDERS: قائمة مزودي الساعات المعروفة (ثابتة في الكود)
// من lib/wearables/providers.
import { PROVIDERS } from '@/lib/wearables/providers';

// ========================================
// 2. معالج القراءة (GET)
// ========================================

/** قائمة المزودين المتاحين + اتصالات المستخدم الحالية. */
// GET: يبني قائمة المزودين مع حالة اتصال كل مزود بهذا المستخدم.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب كل اتصالات المستخدم (الأحدث أولًا).
  const connections = await prisma.wearableConnection.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  // الخطوة 3: دمج المزودين مع اتصالاتهم.
  // map: نمر على كل مزود ونضيف له خاصية connection —
  // الاتصال الذي يحمل نفس معرّف المزود (p.id) أو null لو لا يوجد.
  const providers = PROVIDERS.map((p) => ({
    ...p,
    connection: connections.find((c) => c.provider === p.id) ?? null,
  }));

  // الخطوة 4: نرجع القائمة المدمجة + قائمة الاتصالات الخام.
  return NextResponse.json({ providers, connections });
}
