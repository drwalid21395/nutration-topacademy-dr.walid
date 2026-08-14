/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/health/activity/route.ts

وظيفة الملف:
واجهة API لنشاط السباح اليومي:
- POST: إدخال نشاط يومي (خطوات/سعرات محروقة/مسافة...) يدويًا
  أو من جهاز لياقة، عبر خط التطبيع الموحّد ingestActivity.
- GET: جلب نشاط اليوم.

لماذا نحتاجه؟
لوحة الصحة اليومية والعدادات المتصلة (الساعة الذكية) ترسل
النشاط هنا ليُخزَّن في جدول DailyActivity ويؤثر على الأهداف
الغذائية الديناميكية.

متى يعمل؟
عند POST/GET إلى /api/health/activity.
(POST يقبل الجلسة أو توكن الموبايل عبر getApiUser، GET عبر getCurrentUser)

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نقرأ النشاط ومصدره (provider).
4. نمرر البيانات لـ ingestActivity (تطبيع + حفظ).
5. نسجل العملية (audit) ونرصد نجاح المزامنة (logSync).
6. أي خطأ → 500 مع تسجيل فشل المزامنة.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: بيانات النشاط ناقصة.
- 429: طلبات كثيرة. 500: فشل في الحفظ.

العلاقة مع الملفات:
- getApiUser من lib/api-user (تعرف على توكن الموبايل).
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit + audit من lib/security.
- ingestActivity + logSync من lib/wearables/sync.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getApiUser: ملف محلي من lib/api-user — يتعرف على المستخدم
// من توكن الموبايل (Bearer) أو من الجلسة العادية.
import { getApiUser } from '@/lib/api-user';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول
// في متصفح الويب العادي.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';
// ingestActivity + logSync: من lib/wearables/sync — دالة توحيد
// النشاط القادم من مصادر مختلفة + تسجيل سجل المزامنة.
import { ingestActivity, logSync } from '@/lib/wearables/sync';

// ========================================
// 2. معالج الطلب POST (إدخال النشاط)
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/health/activity.
// req: كائن الطلب الواصل (يحوي النشاط ومصدره).
/** إدخال نشاط يومي (يدوي أو من جهاز) عبر خط التطبيع الموحّد. */
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من المستخدم — سواء جاء من الجلسة أو توكن الموبايل.
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 30 طلبًا في الدقيقة.
  if (!rateLimit(`health:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  let body: { provider?: string; activity?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // provider: مصدر النشاط (manual = يدوي، أو اسم جهاز مثل fitbit).
  // activity: بيانات النشاط نفسها (خطوات، سعرات...).
  const provider = String(body.provider ?? 'manual');
  const activity = body.activity;
  // لو لا توجد بيانات نشاط حقيقية → 422.
  if (!activity || typeof activity !== 'object') {
    return NextResponse.json({ error: 'بيانات النشاط مطلوبة' }, { status: 422 });
  }

  // الخطوة 4: قياس الوقت المستغرق (لسجلات المزامنة).
  const started = Date.now();
  try {
    // ingestActivity: دالة "التطبيع الموحّد" — تحوّل بيانات أي مصدر
    // إلى شكل موحّد وتحفظها في جدول DailyActivity.
    const result = await ingestActivity(user.id, activity, provider);
    // تسجيل العملية في سجل التدقيق.
    await audit(user.id, 'health.activity.ingest', 'DailyActivity', undefined, { provider });
    // logSync: تسجيل نجاح المزامنة مع المدة المستغرقة.
    await logSync(user.id, provider, 'success', 1, result.message, Date.now() - started);
    // نرجع نتيجة التطبيع معها.
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // أي خطأ: نسجل فشل المزامنة ثم نرجع 500.
    await logSync(user.id, provider, 'error', 0, err instanceof Error ? err.message : 'فشل الإدخال', Date.now() - started);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذر الحفظ' }, { status: 500 });
  }
}

// ========================================
// 3. معالج الطلب GET (نشاط اليوم)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
/** نشاط اليوم. */
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول (من الجلسة في المتصفح).
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نحدد بداية اليوم (منتصف الليل) لنجلب نشاط هذا اليوم فقط.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // findUnique بـ userId_date: جدول DailyActivity له مفتاح فريد
  // مركّب (مستخدم + تاريخ) — كل مستخدم له سجل واحد لكل يوم.
  const activity = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  return NextResponse.json({ activity });
}
