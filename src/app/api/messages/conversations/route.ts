/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/messages/conversations/route.ts

وظيفة الملف:
واجهة API بحرف GET تعرض قائمة المحادثات:
- الدكتور/الأدمن: كل السباحين النشطين، مع آخر رسالة
  لكل محادثة وعدد الرسائل غير المقروءة.
- السباح: محادثة واحدة مع الدكتور.

لماذا نحتاجه؟
صفحة الرسائل تحتاج معرفة "مع من أتحدث؟" لكل محادثة،
وآخر رسالة، وعدد غير المقروء لعرضه بجانب اسم المحادثة.

متى يعمل؟
عند وصول طلب GET إلى /api/messages/conversations.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. لو أدمن: نجلب كل السباحين النشطين ونحصي غير المقروء
   لكل واحد، ونجلب آخر رسالة لكل محادثة.
3. لو سباح: نجلب حساب الدكتور ونبني محادثة واحدة.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول
// ويعيد بيانات المستخدم الحالي (أو null لو غير مسجل).
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. تعريف شكل المحادثة
// ========================================

// ConvEntry: "نوع TypeScript" يصف شكل كل محادثة معروضة:
// id/name/image/fullName: بيانات الطرف الآخر.
// lastMessage: آخر رسالة (أو null لو لا توجد رسائل).
// unread: عدد الرسائل غير المقروءة.
/**
 * قائمة المحادثات:
 * - الدكتور: كل السباحين النشطين + آخر رسالة + عدد غير المقروء
 * - السباح: محادثة واحدة مع الدكتور
 */
type ConvEntry = {
  id: string;
  name: string | null;
  image: string | null;
  fullName: string | null;
  role: string;
  lastMessage: { id: string; body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
};

// ========================================
// 3. معالج الطلب GET
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: لو المستخدم أدمن/دكتور — نبني قائمة كل السباحين.
  if (me.role === 'admin') {
    // 2أ. نجلب كل السباحين النشطين (مع أول ملف غذائي لاسمهم الكامل).
    const athletes = await prisma.user.findMany({
      where: { role: 'athlete', status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        image: true,
        profiles: { select: { fullName: true }, take: 1 },
      },
    });

    // 2ب. groupBy: نحصي الرسائل غير المقروءة الواردة إلى الأدمن
    // مجمّعة حسب المرسل، لمعرفة عدد غير المقروء لكل سباح.
    const unreadRows = await prisma.message.groupBy({
      by: ['fromId'],
      where: { toId: me.id, isRead: false },
      _count: { _all: true },
    });
    // Map: خريطة سريعة (fromId ← عدد غير المقروء) للوصول الفوري.
    const unreadMap = new Map(unreadRows.map((r) => [r.fromId, r._count._all]));

    // 2ج. لكل سباح: نجلب آخر رسالة في محادثته مع الأدمن.
    const conversations: ConvEntry[] = [];
    for (const a of athletes) {
      // OR: رسالة أرسلها الأدمن للسباح، أو أرسلها السباح للأدمن
      // (أي رسالة بينهما في الاتجاهين) مرتبة من الأحدث.
      const last = await prisma.message.findFirst({
        where: {
          OR: [
            { fromId: me.id, toId: a.id },
            { fromId: a.id, toId: me.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, body: true, fromId: true, createdAt: true },
      });
      // نبني مدخل المحادثة: آخر رسالة مع علامة fromMe (هل أرسلها الأدمن؟)
      // وعدد غير المقروء (أو 0 إن لا توجد).
      conversations.push({
        id: a.id,
        name: a.name,
        image: a.image,
        fullName: a.profiles[0]?.fullName ?? null,
        role: 'athlete',
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              fromMe: last.fromId === me.id,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unread: unreadMap.get(a.id) ?? 0,
      });
    }
    return NextResponse.json({ conversations });
  }

  // الخطوة 3: لو المستخدم سباح — محادثة واحدة مع الدكتور.
  // السباح: محادثة واحدة مع الدكتور
  // نجلب حساب الأدمن النشط (الطرف الوحيد الذي يراسله السباح).
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, image: true, profiles: { select: { fullName: true }, take: 1 } },
  });
  // لو لا يوجد أدمن بعد → محادثات فارغة.
  if (!admin) return NextResponse.json({ conversations: [] });

  // آخر رسالة بين السباح والأدمن (في الاتجاهين).
  const last = await prisma.message.findFirst({
    where: {
      OR: [
        { fromId: me.id, toId: admin.id },
        { fromId: admin.id, toId: me.id },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, body: true, fromId: true, createdAt: true },
  });
  // عدد الرسائل غير المقروءة التي أرسلها الدكتور للسباح.
  const unread = await prisma.message.count({
    where: { fromId: admin.id, toId: me.id, isRead: false },
  });

  // نرجع محادثة واحدة باسم الدكتور وبياناته.
  return NextResponse.json({
    conversations: [
      {
        id: admin.id,
        name: admin.name,
        image: admin.image,
        fullName: admin.profiles[0]?.fullName ?? null,
        role: 'admin',
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              fromMe: last.fromId === me.id,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unread,
      },
    ],
  });
}
