/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/health/workouts/route.ts

وظيفة الملف:
واجهة API لجلسات التدريب:
- POST: إدخال قائمة تدريبات (يدويًا أو من جهاز لياقة) مع
  إزالة التكرار (upsert)، ثم إعادة حساب الهدف الغذائي لليوم.
- GET: جلب تدريبات اليوم.

لماذا نحتاجه؟
الساعة الذكية أو الإدخال اليدوي يرسلان جلسات التدريب هنا
لتُخزَّن في جدول WorkoutSession، ويُحدَّث الهدف الغذائي
السيناريو (ركلو)، لأن التدريب يحرق سعرات إضافية.

متى يعمل؟
عند POST/GET إلى /api/health/workouts.
(POST يقبل الجلسة أو توكن الموبايل عبر getApiUser)

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نقرأ قائمة التدريبات ومصدرها.
4. نمررها لـ ingestWorkouts (تطبيع + إزالة تكرار).
5. نعيد حساب أهداف اليوم عبر recalculateToday.
6. نسجل العملية (audit) ونرصد نجاح المزامنة (logSync).
7. أي خطأ → 500 مع تسجيل الفشل.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: القائمة فارغة.
- 429: طلبات كثيرة. 500: فشل في الحفظ.

العلاقة مع الملفات:
- getApiUser من lib/api-user (تعرف على توكن الموبايل).
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit + audit من lib/security.
- ingestWorkouts + logSync من lib/wearables/sync.
- recalculateToday من lib/nutrition/dynamic.
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
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';
// ingestWorkouts + logSync: من lib/wearables/sync — توحيد التدريبات
// الواردة من مصادر مختلفة + تسجيل سجل المزامنة.
import { ingestWorkouts, logSync } from '@/lib/wearables/sync';
// recalculateToday: من lib/nutrition/dynamic — إعادة حساب الهدف
// الغذائي الديناميكي لليوم بعد أي تمرين (السعرات المحروقة تغيّر الهدف).
import { recalculateToday } from '@/lib/nutrition/dynamic';

// ========================================
// 2. معالج الطلب POST (إدخال التدريبات)
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/health/workouts.
// req: كائن الطلب الواصل (يحوي قائمة التدريبات ومصدرها).
/** إدخال تدريبات (يدوي أو من جهاز) مع إزالة التكرار. */
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من المستخدم — سواء من الجلسة أو توكن الموبايل.
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 30 طلبًا في الدقيقة.
  if (!rateLimit(`workout:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  let body: { provider?: string; workouts?: Array<Record<string, unknown>> };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // provider: مصدر التدريبات (manual أو اسم جهاز).
  // workouts: قائمة جلسات التدريب. Array.isArray: نتأكد أنها قائمة فعلًا.
  const provider = String(body.provider ?? 'manual');
  const workouts = Array.isArray(body.workouts) ? body.workouts : [];
  // لو القائمة فارغة → 422 (لا يوجد شيء نحفظه).
  if (workouts.length === 0) {
    return NextResponse.json({ error: 'قائمة التدريبات مطلوبة' }, { status: 422 });
  }

  // الخطوة 4: قياس الوقت المستغرق (لسجلات المزامنة).
  const started = Date.now();
  try {
    // ingestWorkouts: تطبيع التدريبات وحفظها مع إزالة التكرار
    // (نفس الجلسة من نفس المصدر لا تُحفظ مرتين).
    const result = await ingestWorkouts(user.id, workouts, provider);
    // بعد التمرين: إعادة حساب أهداف اليوم (السعرات المحروقة تزيد الهدف).
    await recalculateToday(user.id);
    // تسجيل العملية في سجل التدقيق مع عدد الجلسات المحفوظة.
    await audit(user.id, 'health.workout.ingest', 'WorkoutSession', undefined, { provider, count: result.workoutsUpserted });
    // logSync: تسجيل نجاح المزامنة.
    await logSync(user.id, provider, 'success', result.workoutsUpserted, result.message, Date.now() - started);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // أي خطأ: نسجل فشل المزامنة ثم نرجع 500.
    await logSync(user.id, provider, 'error', 0, err instanceof Error ? err.message : 'فشل الإدخال', Date.now() - started);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذر الحفظ' }, { status: 500 });
  }
}

// ========================================
// 3. معالج الطلب GET (تدريبات اليوم)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
/** تدريبات اليوم. */
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول (من الجلسة في المتصفح).
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نحدد بداية اليوم ثم نجلب التدريبات التي بدأت بعده.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // findMany: كل التدريبات التي startTime فيها أكبر من أو يساوي اليوم.
  // gte: أكبر من أو يساوي (greater than or equal).
  const workouts = await prisma.workoutSession.findMany({
    where: { userId: user.id, startTime: { gte: today } },
    orderBy: { startTime: 'desc' },
  });
  return NextResponse.json({ workouts });
}
