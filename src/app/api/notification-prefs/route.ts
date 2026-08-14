/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/notification-prefs/route.ts

وظيفة الملف:
واجهة API لتفضيلات إشعارات المستخدم:
- GET: جلب تفضيلاته المحفوظة من جدول NotificationPref.
- PUT: حفظ/تحديث التفضيلات (إن لم يوجد سجل نُنشئه بـ upsert).

لماذا نحتاجه؟
صفحة إعدادات الإشعارات تعرض مواعيد الوجبات والتذكيرات
وحالة الأصوات/الدفع؛ يتيح هذا الملف للمستخدم تخصيص
متى وماذا يتلقى من تنبيهات.

متى يعمل؟
عند GET/PUT إلى /api/notification-prefs.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. (PUT) هل أرسل طلبات كثيرة؟ → 429.
3. (GET) نجلب التفضيلات ونفك تشفير الحقول المخزنة كنص JSON.
4. (PUT) نقرأ الحقول المسموحة فقط ونخزنها بالشكل الصحيح لكل نوع.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit من lib/security.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit: ملف محلي من lib/security — منع الطلبات الكثيرة.
import { rateLimit } from '@/lib/security';

// ========================================
// 2. الثوابت
// ========================================

// PREF_KEYS: القائمة الوحيدة المسموح بحفظها من التفضيلات.
// لا نقبل أي حقل آخر غير موجود هنا (حماية من تعديل بيانات غير مقصودة).
const PREF_KEYS = [
  'breakfastTime', 'lunchTime', 'dinnerTime', 'snackTimes', 'preWorkoutTime', 'postWorkoutTime',
  'waterInterval', 'trainingTime', 'sleepTime', 'weighInTime', 'competitionReminderDays',
  'planReviewReminderDays', 'soundEnabled', 'quietHoursStart', 'quietHoursEnd', 'pushEnabled',
  'inAppEnabled', 'smartAlerts', 'waterLowAlertThreshold', 'days',
];

// ========================================
// 3. معالج الطلب GET (جلب التفضيلات)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نجلب تفضيلات هذا المستخدم من جدول NotificationPref.
  const prefs = await prisma.notificationPref.findUnique({ where: { userId: user.id } });
  // لو لا توجد تفضيلات محفوظة بعد → نرجع null.
  if (!prefs) {
    return NextResponse.json({ prefs: null });
  }
  // الخطوة 3: نرجع التفضيلات، لكن نفك تشفير الحقلين المخزنين كنص
  // JSON (days و snackTimes) إلى كائنات حقيقية قبل الإرسال.
  return NextResponse.json({
    prefs: {
      ...prefs,
      days: prefs.days ? safeParse(prefs.days) : undefined,
      snackTimes: prefs.snackTimes ? safeParse(prefs.snackTimes) : undefined,
    },
  });
}

// ========================================
// 4. معالج الطلب PUT (حفظ التفضيلات)
// ========================================

// export async function PUT:
// Next.js يستدعي PUT تلقائيًا عند وصول طلب PUT لهذا المسار
// (PUT = استبدال كامل، هنا نقبل تحديث الحقول المرسلة فقط).
// req: كائن الطلب الواصل (يحوي حقول التفضيلات).
export async function PUT(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 20 طلبًا في الدقيقة.
  if (!rateLimit(`prefs:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: نمر على القائمة المسموحة PREF_KEYS فقط.
  // continue: نتجاوز الحقول غير المرسلة. ثم نجهّز كل قيمة بنوعها:
  // - days/snackTimes: قائمة → نخزنها نص JSON.
  // - boolean/number: نرسلها كما هي.
  // - غير ذلك: نص، أو null لو القيمة فارغة.
  const data: Record<string, unknown> = {};
  for (const key of PREF_KEYS) {
    if (body[key] === undefined) continue;
    if (key === 'days' || key === 'snackTimes') {
      data[key] = Array.isArray(body[key]) ? JSON.stringify(body[key]) : String(body[key] ?? '');
    } else if (typeof body[key] === 'boolean' || typeof body[key] === 'number') {
      data[key] = body[key];
    } else {
      data[key] = body[key] === null || body[key] === '' ? null : String(body[key]);
    }
  }

  // الخطوة 5: upsert — إن وُجد سجل نحدّثه، وإن لم يوجد ننشئه.
  // (مستخدم واحد له سجل تفضيلات واحد فقط في الجدول).
  const prefs = await prisma.notificationPref.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return NextResponse.json({ ok: true, prefs });
}

// ========================================
// 5. دالة مساعدة (فك نص JSON)
// ========================================

// safeParse: تحاول قراءة النص كـ JSON؛ لو فشل (النص ليس JSON)
// تعيد النص كما هو بدل إيقاع خطأ يكسر الطلب.
function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
