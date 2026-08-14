/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/admin/reports/route.ts

وظيفة الملف:
واجهة API بحرف GET تنشئ تقرير الالتزام الغذائي للأدمن:
حساب نسبة التزام كل سباح بالخطة (سعرات/بروتين/كربوهيدرات/
دهون/ماء) لليوم ولآخر 7 أيام، ثم تصدير التقرير:
- PDF عبر buildAdminReportPdf.
- CSV متوافق مع Excel عبر buildCsv.
مع حفظ نسخة في Google Drive.

لماذا نحتاجه؟
الدكتور يحتاج تقريرًا جاهزًا للطباعة/المشاركة يوضح مدى
التزام كل سباح بخطته — وهذا الملف يولّده في صيغتين.

متى يعمل؟
عند وصول طلب GET إلى /api/admin/reports?format=pdf|csv&userId=<id>&days=7
(اختياري تحديد سباح معين وعدد الأيام) — للأدمن فقط.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401، ولو ليس أدمن → 403.
2. نقرأ معاملات الرابط (format / userId / days).
3. نجمع معرفات السباحين، ونجلب بياناتهم وخططهم وسجلات اليوم.
4. نحسب نسبة الالتزام لكل سباح وأيام تسجيله في آخر 7 أيام.
5. نبني ملف CSV أو PDF ونحفظ نسخة في درايف ونرجعه للتحميل.

ماذا يعني HTTP Status؟
- 200: نجاح (ملف CSV/PDF). 401: غير مسجل.
- 403: ليست لديك صلاحية. 404: لا يوجد سباحون.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- startOfToday من lib/utils.
- buildAdminReportPdf + buildCsv + نوع AdminReportRow من
  services/pdf/admin-report-pdf.
- saveReportToDrive من lib/google-sync.
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
// startOfToday: من lib/utils — دالة تعيد بداية اليوم الحالي (منتصف الليل).
import { startOfToday } from '@/lib/utils';
// buildAdminReportPdf + buildCsv + AdminReportRow: من
// services/pdf/admin-report-pdf — دوال بناء الملفات ونوع صفوف التقرير.
import { buildAdminReportPdf, buildCsv, type AdminReportRow } from '@/services/pdf/admin-report-pdf';
// saveReportToDrive: من lib/google-sync — حفظ نسخة في Google Drive.
import { saveReportToDrive } from '@/lib/google-sync';

// ========================================
// 2. معالج الطلب GET (توليد التقرير)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
// (ملاحظة: التعليقات النصية العربية في هذا الملف تحمل ترميزًا
// تالفًا قديمًا — نتركها كما هي كما هو مطلوب، دون تغييرها.)
/**
 * طھظ‚ط§ط±ظٹط± ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ ظ„ظ„ط£ط¯ظ…ظ†.
 * GET ?format=pdf|csv&userId=<id>&days=7
 * PDF ظˆ Excel (CSV ظ…طھظˆط§ظپظ‚ ظ…ط¹ Excel ط§ظ„ط¹ط±ط¨ظٹ) â€” ظ…ط¹ ط­ظپط¸ ظ†ط³ط®ط© ظپظٹ Google Drive.
 */
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول + أن المستخدم أدمن.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ظ„ظٹط³طھ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط©' }, { status: 403 });

  // الخطوة 2: قراءة معاملات الرابط.
  // format: pdf أو csv (الافتراضي pdf).
  // userId: اختياري — سباح واحد أم الكل.
  // days: عدد الأيام (بين 1 و 90، الافتراضي 7).
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'pdf') === 'csv' ? 'csv' : 'pdf';
  const userId = url.searchParams.get('userId') ?? undefined;
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);

  // حدود الفترة: من بداية اليوم الحالي و قبل 7 أيام (لعدّ أيام التسجيل).
  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // الخطوة 3: نجمع معرفات السباحين (كلهم أو واحد محدد).
  // status: { not: 'deleted' } نستبعد المحذوفين.
  const swimmerIds = await prisma.user.findMany({
    where: { role: 'athlete', status: { not: 'deleted' }, ...(userId ? { id: userId } : {}) },
    select: { id: true },
  });
  const ids = swimmerIds.map((s) => s.id);

  // لو لا يوجد سباحون → 404.
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ظ„ط§ ظٹظˆط¬ط¯ ط³ط¨ط§ط­ظˆظ†' }, { status: 404 });
  }

  // الخطوة 4: جلب بيانات السباحين + سجلات الأسبوع بالتوازي.
  // users: بيانات كل سباح مع أحدث ملف وخطط نشطة وسجلات اليوم.
  // foodLogDays: عدّ سجلات الطعام لكل سباح لكل يوم من آخر أسبوع
  // (نستخدمها لحساب "أيام التسجيل").
  const [users, foodLogDays] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        profiles: { orderBy: { updatedAt: 'desc' }, take: 1, select: { fullName: true } },
        mealPlans: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, title: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
        },
        foodLogs: {
          where: { date: { gte: todayStart } },
          select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
        },
        waterLogs: { where: { date: { gte: todayStart } }, select: { amountMl: true } },
      },
    }),
    prisma.foodLogEntry.groupBy({
      by: ['userId', 'date'],
      where: { date: { gte: weekAgo }, userId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  // daysPerUser: خريطة (سباح ← مجموعة أيام سجّل فيها طعامًا).
  // Set يمنع تكرار نفس اليوم.
  const daysPerUser = new Map<string, Set<string>>();
  for (const row of foodLogDays) {
    const key = row.date.toISOString().slice(0, 10);
    if (!daysPerUser.has(row.userId)) daysPerUser.set(row.userId, new Set());
    daysPerUser.get(row.userId)!.add(key);
  }

  // الخطوة 5: بناء صفوف التقرير لكل سباح.
  const rows: AdminReportRow[] = users.map((u) => {
    const plan = u.mealPlans[0] ?? null; // أحدث خطة نشطة.
    // food: نجمّع سجلات اليوم (سعرات/بروتين/كربوهيدرات/دهون/ماء من الطعام).
    const food = u.foodLogs.reduce<{ c: number; p: number; ca: number; f: number; w: number }>(
      (a, e) => ({
        c: a.c + (e.calories ?? 0),
        p: a.p + (e.proteinG ?? 0),
        ca: a.ca + (e.carbsG ?? 0),
        f: a.f + (e.fatG ?? 0),
        w: a.w + (e.waterMl ?? 0),
      }),
      { c: 0, p: 0, ca: 0, f: 0, w: 0 }
    );
    // الماء الكلي = ماء الطعام + ماء المسجل مباشرة.
    const waterMl = food.w + u.waterLogs.reduce((a, w) => a + w.amountMl, 0);
    // pct: نسبة الاستهلاك من الهدف (بحد أقصى 100%)، أو null لو لا هدف.
    const pct = (v: number, t: number | null | undefined) => (t && t > 0 ? Math.min(100, Math.round((v / t) * 100)) : null);

    return {
      name: u.profiles[0]?.fullName ?? u.name ?? u.email,
      email: u.email,
      planTitle: plan?.title ?? null,
      caloriesPct: pct(food.c, plan?.totalCalories),
      proteinPct: pct(food.p, plan?.proteinG),
      carbsPct: pct(food.ca, plan?.carbsG),
      fatPct: pct(food.f, plan?.fatG),
      waterPct: pct(waterMl, plan?.waterMl),
      activeDays7: daysPerUser.get(u.id)?.size ?? 0, // عدد أيام تسجيله في الأسبوع.
      todayCalories: Math.round(food.c),
      todayProtein: Math.round(food.p),
      todayWaterMl: Math.round(waterMl),
    };
  });

  // الخطوة 6: تجهيز عنوان الملف واسمه.
  const issueDate = new Date().toLocaleDateString('ar-EG');
  const swimmerLabel = userId ? rows[0]?.name ?? 'ط§ظ„ط³ط¨ط§ط­' : 'ط¬ظ…ظٹط¹ ط§ظ„ط³ط¨ط§ط­ظٹظ†';
  const title = `طھظ‚ط±ظٹط± ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ â€” ${swimmerLabel}`;
  const subtitle = `ط§ظ„ظپطھط±ط©: ط¢ط®ط± ${days} ظٹظˆظ… آ· طھط§ط±ظٹط® ط§ظ„ط¥طµط¯ط§ط±: ${issueDate}`;
  const fileName = `adherence-report-${userId ?? 'all'}-${new Date().toISOString().slice(0, 10)}`;

  // الخطوة 7: لو المطلوب CSV — نبنيه ونرجعه كمرفق تحميل.
  if (format === 'csv') {
    // buildCsv: يبني نص CSV من رؤوس الأعمدة وصفوف البيانات.
    const csv = buildCsv(
      ['ط§ظ„ط³ط¨ط§ط­', 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'ط§ظ„ط®ط·ط©', 'ط³ط¹ط±ط§طھ ط§ظ„ظٹظˆظ…', 'ط¨ط±ظˆطھظٹظ† ط§ظ„ظٹظˆظ…', 'ظ…ط§ط، ط§ظ„ظٹظˆظ…', '% ط³ط¹ط±ط§طھ', '% ط¨ط±ظˆطھظٹظ†', '% ظƒط§ط±ط¨', '% ط¯ظ‡ظˆظ†', '% ظ…ط§ط،', 'ط£ظٹط§ظ… طھط³ط¬ظٹظ„ (7)'],
      rows.map((r) => [
        r.name,
        r.email,
        r.planTitle ?? 'ط¨ط¯ظˆظ† ط®ط·ط©',
        r.todayCalories,
        r.todayProtein,
        r.todayWaterMl,
        r.caloriesPct ?? '',
        r.proteinPct ?? '',
        r.carbsPct ?? '',
        r.fatPct ?? '',
        r.waterPct ?? '',
        r.activeDays7,
      ])
    );
    // نسخة احتياطية في درايف (اختيارية).
    saveReportToDrive({
      swimmerName: swimmerLabel,
      kind: 'admin-report',
      fileName: `${fileName}.csv`,
      mimeType: 'text/csv',
      base64: Buffer.from(csv, 'utf8').toString('base64'),
    }).catch(() => {});
    // إرجاع الملف كمرفق تحميل بتشفير UTF-8 (دعم العربية في Excel).
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.csv"`,
      },
    });
  }

  // الخطوة 8: وإلا (PDF) — نبنيه ونرجعه.
  // buildAdminReportPdf: يبني مستند PDF من العنوان والصفوف.
  const pdf = await buildAdminReportPdf({ title, subtitle, rows });
  // نسخة احتياطية في درايف.
  saveReportToDrive({
    swimmerName: swimmerLabel,
    kind: 'admin-report',
    fileName: `${fileName}.pdf`,
    mimeType: 'application/pdf',
    base64: pdf.toString('base64'),
  }).catch(() => {});
  // إرجاع ملف PDF كمرفق تحميل.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
    },
  });
}

