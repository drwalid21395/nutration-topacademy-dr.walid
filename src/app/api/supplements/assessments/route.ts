/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/assessments/route.ts

وظيفة الملف:
واجهة API لإدارة تقييمات المكملات الخاصة بمستخدم واحد:
- GET: قراءة تقييم واحد (بمعرّف) أو قائمة آخر 50 تقييمًا.
- POST: حفظ تقييم جديد (نتيجة المحرك) مع توصياته.
- DELETE: حذف تقييم (لمالكه فقط).

لماذا نحتاجه؟
المحرك يحسب التقييم في الذاكرة، وهنا نحفظه في قاعدة
البيانات ليبقى محفوظًا ويراجعه المختص ويُعرض لاحقًا
ويُبنى منه تقرير PDF.

متى يعمل؟
عند طلبات:
- GET إلى /api/supplements/assessments (واحد أو قائمة).
- POST إلى /api/supplements/assessments (حفظ تقييم).
- DELETE إلى /api/supplements/assessments?id=...

من يستدعي هذا الملف؟
صفحة حاسبة المكملات (حفظ النتيجة) وصفحة سجل التقييمات.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول SupplementAssessment وجداول
  RecommendationItem و Approval (عبر العلاقات).
- أنواع SupplementAssessmentInput / Output من services/supplements/types.

ترتيب العمل (GET):
1. غير مسجل → 401.
2. لو وُجد id في الرابط → نرجع تقييمًا واحدًا → 404 لو غير موجود.
3. لو لا يوجد id → نرجع آخر 50 تقييمًا للمستخدم.

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو JSON غير صالح.
3. لابد من result (نتيجة المحرك) → 422 لو غائبة.
4. نحفظ التقييم وبنوده الفرعية في عملية واحدة.
5. نرجع 201.

ترتيب العمل (DELETE):
1. غير مسجل → 401. لا يوجد id → 422.
2. التقييم غير موجود → 404.
3. نحذف التقييم ونرجع ok.
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
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب به الجداول.
import { prisma } from '@/lib/prisma';
// أنواع TypeScript محلية تصف شكل الإدخال (input) والنتيجة (output)
// لتقييم المكملات. استيراد type يعني أنه يختفي بعد الترجمة.
import type { SupplementAssessmentInput, SupplementAssessmentOutput } from '@/services/supplements/types';

// ========================================
// 2. معالج القراءة (GET)
// ========================================

// GET: قراءة تقييمات المستخدم.
// يدعم معامل id في الرابط: لو وُجد نرجع تقييمًا واحدًا،
// وإلا نرجع قائمة آخر 50 تقييمًا مرتبة من الأحدث.
export async function GET(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معامل id من عنوان الطلب (؟id=...).
  // new URL: نحوّل الرابط إلى كائن يسهل استخراج المعاملات منه.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // الخطوة 3أ: طلب تقييم واحد.
  if (id) {
    // findFirst بشرط id و userId — لا يرى المستخدم إلا تقييماته.
    // include: نجلب معه بنود التوصيات وبيانات الموافقين (الاسم والدور)
    // كمعلومات مصاحبة مفيدة للعرض.
    const assessment = await prisma.supplementAssessment.findFirst({
      where: { id, userId: user.id },
      include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
    });
    if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });
    return NextResponse.json({ assessment });
  }

  // الخطوة 3ب: طلب القائمة — آخر 50 تقييمًا.
  // orderBy createdAt desc: من الأحدث للأقدم. take: حد أقصى 50.
  const assessments = await prisma.supplementAssessment.findMany({
    where: { userId: user.id },
    include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ assessments });
}

// ========================================
// 3. معالج الحفظ (POST)
// ========================================

/** حفظ تقييم (نتيجة المحرك) مع توصياته */
// POST: حفظ تقييم جديد قادم من المحرك.
// يخزن تقييمًا واحدًا في SupplementAssessment وبندًا لكل
// توصية في RecommendationItem — داخل عملية واحدة مترابطة.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // input: ما أرسله المستخدم للمحرك (اختياري). result: نتيجة المحرك.
  // profileId: ملف السباح المرتبط (اختياري).
  let body: { input?: SupplementAssessmentInput; result?: SupplementAssessmentOutput; profileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: لابد من وجود نتيجة الحساب.
  // 422: البيانات غير مكتملة.
  const result = body.result;
  if (!result) return NextResponse.json({ error: 'نتيجة التقييم مطلوبة' }, { status: 422 });

  // الخطوة 4: الحفظ في قاعدة البيانات.
  // status: 'needs-review' — التقييم يحتاج مراجعة المختص بعد الحفظ.
  // الحقول الكائنات (coverage/eligibility/...) تُخزَّن كنص JSON
  // لأن الأعمدة نصية. reassessAt: موعد إعادة التقييم بعد 30 يومًا.
  // recommendationItems.create: ننشئ بندًا في جدول RecommendationItem
  // لكل توصية من التوصيات (قائمة result.recommendations).
  const saved = await prisma.supplementAssessment.create({
    data: {
      userId: user.id,
      profileId: body.profileId ?? null,
      version: result.version,
      status: 'needs-review',
      overallLevel: result.overallLevel,
      needsMedicalApproval: result.needsMedicalApproval,
      needsGuardianConsent: result.needsGuardianConsent,
      needsLabTest: result.needsLabTest,
      coverage: JSON.stringify(result.coverage),
      eligibility: JSON.stringify(result.eligibility),
      proteinGap: JSON.stringify(result.proteinGap),
      hydration: JSON.stringify(result.hydration),
      recommendations: JSON.stringify(result.recommendations),
      schedule: JSON.stringify(result.schedule),
      foodAlternatives: JSON.stringify(result.foodAlternatives),
      reassessAt: new Date(Date.now() + 30 * 86400000),
      recommendationItems: {
        create: result.recommendations.map((rec) => ({
          supplementKey: rec.key,
          nameAr: rec.nameAr,
          status: rec.status,
          eligibilityVerdict: rec.verdict,
          evidenceStrength: rec.evidenceStrength,
          coverageFromFood: rec.coverageFromFoodPct,
          deficit: rec.deficit,
          doseEstimate: rec.doseEstimate,
          doseUnit: rec.doseUnit,
          timingAr: rec.timingAr,
          durationDays: rec.durationDays,
          upperLimitWarning: rec.upperLimitWarning,
          medicalNote: rec.medicalNote,
        })),
      },
    },
    include: { recommendationItems: true, approvals: true },
  });

  // الخطوة 5: إرسال الرد مع التقييم المحفوظ.
  // 201 = تم إنشاء مورد جديد بنجاح.
  return NextResponse.json({ ok: true, assessment: saved }, { status: 201 });
}

// ========================================
// 4. معالج الحذف (DELETE)
// ========================================

// DELETE: حذف تقييم معيّن — بشرط أن يكون للمستخدم نفسه.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معامل id من الرابط. بدونه → 422.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  // الخطوة 3: التأكد أن التقييم موجود ويملكه المستخدم → وإلا 404.
  const existing = await prisma.supplementAssessment.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  // الخطوة 4: الحذف الفعلي من قاعدة البيانات.
  await prisma.supplementAssessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
