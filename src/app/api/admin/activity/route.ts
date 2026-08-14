/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/admin/activity/route.ts

وظيفة الملف:
واجهة API بحرف GET تبني "سجل النشاط الشامل" للدكتور/الأدمن:
تجميع آخر الإشعارات والرسائل والوجبات والتدريبات والماء
وتحليلات الذكاء الاصطناعي لكل السباحين في قائمة واحدة
مرتبة من الأحدث إلى الأقدم.

لماذا نحتاجه؟
لوحة الدكتور الرئيسية تعرض شريط نشاط حيًا: "أكل فلان،
أرسل فلان رسالة..." — هذا الملف يجهّز هذه القائمة الموحدة.

متى يعمل؟
عند وصول طلب GET إلى /api/admin/activity — للأدمن فقط.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401، ولو ليس أدمن → 403.
2. نجلب آخر سجلات من 6 جداول بالتوازي (Promise.all).
3. نحوّل كل سجل إلى عنصر ActivityItem موحد (مع معرّف فريد لكل نوع).
4. نرتب الكل تنازليًا ونرجع أول 100 عنصر.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل. 403: ليست لديك صلاحية.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextResponse: أداة Next.js لإرسال الرد. من مكتبة next/server.
import { NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. تعريف شكل عنصر النشاط
// ========================================

// ActivityItem: "نوع TypeScript" يصف كل عنصر في السجل:
// kind: نوع الحدث (إشعار/رسالة/وجبة/تدريب/ماء/تحليل).
// swimmerId/Name/Image: بيانات السباح صاحب الحدث.
// title/body: نص العنوان والتفصيل للعرض.
// link: رابط يقود الدكتور لصفحة السباح إن وُجد.
type ActivityItem = {
  id: string;
  kind: 'notification' | 'message' | 'food' | 'training' | 'water' | 'analysis';
  swimmerId: string;
  swimmerName: string;
  swimmerImage: string | null;
  title: string;
  body: string;
  createdAt: string;
  link?: string;
};

// ========================================
// 3. معالج الطلب GET
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
/**
 * سجل النشاط الشامل للدكتور: كل الإشعارات والرسائل والوجبات والتمارين لكل السباحين.
 * مرتب تنازليًا حسب الأحدث.
 */
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول + أن المستخدم أدمن.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

  // الخطوة 2: نجلب آخر السجلات من 6 جداول بالتوازي.
  // Promise.all: يشغّل كل الاستعلامات معًا (أسرع من التسلسل).
  // take: عدد أقصى لكل جدول. include.user: نأخذ بيانات السباح مع السجل.
  const [notifications, messages, foodLogs, trainingLogs, waterLogs, analyses] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        from: { select: { id: true, name: true, image: true, role: true } },
        to: { select: { id: true, name: true, image: true, role: true } },
      },
    }),
    prisma.foodLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.trainingLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.waterLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
    prisma.mealAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true, role: true } } },
    }),
  ]);

  // الخطوة 3: القائمة النهائية الموحدة.
  const items: ActivityItem[] = [];

  // 3أ. الإشعارات — نستبعد إشعارات الأدمن نفسه (continue) حتى لا يشوش السجل.
  for (const n of notifications) {
    if (n.user.role === 'admin' && n.userId === user.id) continue;
    items.push({
      id: `n-${n.id}`, // معرّف فريد ببادئة النوع حتى لا تتصادم المعرّفات.
      kind: 'notification',
      swimmerId: n.userId,
      swimmerName: n.user.name ?? 'سباح',
      swimmerImage: n.user.image,
      title: `إشعار: ${n.title}`,
      body: n.body ?? '',
      createdAt: n.createdAt.toISOString(),
    });
  }

  // 3ب. الرسائل — نحدد الطرف الآخر (السباح) ثم نتجاهل رسائل الأدمن للأدمن.
  for (const m of messages) {
    const from = m.fromId === user.id ? m.to : m.from;
    if (from.role === 'admin') continue;
    items.push({
      id: `m-${m.id}`,
      kind: 'message',
      swimmerId: from.id,
      swimmerName: from.name ?? 'سباح',
      swimmerImage: from.image,
      title: m.fromId === user.id ? `رسالة إلى ${from.name ?? 'السباح'}` : `رسالة من ${from.name ?? 'السباح'}`,
      body: m.body.slice(0, 120), // أول 120 حرفًا فقط.
      createdAt: m.createdAt.toISOString(),
      link: '/messages',
    });
  }

  // 3ج. الوجبات المسجلة.
  for (const f of foodLogs) {
    items.push({
      id: `f-${f.id}`,
      kind: 'food',
      swimmerId: f.userId,
      swimmerName: f.user.name ?? 'سباح',
      swimmerImage: f.user.image,
      title: 'وجبة مسجلة',
      // نص وصفي: اسم الوجبة + سعراتها + بروتينها إن وُجد.
      body: `${f.foodName} — ${f.calories ?? 0} سعرة${f.proteinG ? ` · بروتين ${f.proteinG} جم` : ''}`,
      createdAt: f.createdAt.toISOString(),
      link: `/admin/swimmer/${f.userId}`, // يفتح صفحة السباح.
    });
  }

  // 3د. التدريبات — سباحة أم لياقة (gym).
  for (const t of trainingLogs) {
    const type = t.sessionType === 'gym' ? 'تمرين لياقة' : 'تمرين سباحة';
    items.push({
      id: `t-${t.id}`,
      kind: 'training',
      swimmerId: t.userId,
      swimmerName: t.user.name ?? 'سباح',
      swimmerImage: t.user.image,
      title: type,
      body: `${t.durationMin ?? 0} دقيقة${t.distanceM ? ` · ${t.distanceM} متر` : ''}${t.caloriesBurned ? ` · ${t.caloriesBurned} سعرة محروقة` : ''}`,
      createdAt: t.createdAt.toISOString(),
      link: `/admin/swimmer/${t.userId}`,
    });
  }

  // 3هـ. تسجيلات الماء.
  for (const w of waterLogs) {
    items.push({
      id: `w-${w.id}`,
      kind: 'water',
      swimmerId: w.userId,
      swimmerName: w.user.name ?? 'سباح',
      swimmerImage: w.user.image,
      title: 'تسجيل ماء',
      body: `${w.amountMl} مل`,
      createdAt: w.createdAt.toISOString(),
      link: `/admin/swimmer/${w.userId}`,
    });
  }

  // 3و. تحليلات الوجبات بالذكاء الاصطناعي.
  for (const a of analyses) {
    items.push({
      id: `a-${a.id}`,
      kind: 'analysis',
      swimmerId: a.userId,
      swimmerName: a.user.name ?? 'سباح',
      swimmerImage: a.user.image,
      title: 'تحليل وجبة بالذكاء الاصطناعي',
      body: `${a.totalCalories ?? 0} سعرة${a.confidence ? ` · ثقة ${Math.round(a.confidence)}٪` : ''}`,
      createdAt: a.createdAt.toISOString(),
      link: `/admin/swimmer/${a.userId}`,
    });
  }

  // الخطوة 4: الترتيب التنازلي (الأحدث أولًا) والاكتفاء بأول 100 عنصر.
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ items: items.slice(0, 100) });
}
