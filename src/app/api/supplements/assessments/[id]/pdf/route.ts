/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/assessments/[id]/pdf/route.ts

وظيفة الملف:
واجهة API بحرف GET تُولّد تقرير PDF جاهز للطباعة
لتقييم المكملات الخاص بسباح معيّن، وتُحمِّله للمتصفح
كملف مرفق (attachment) لتحميله، وتحاول نسخه احتياطيًا
إلى Google Drive.

لماذا نحتاجه؟
السباح (أو ولي أمره) قد يحتاج تقريرًا ورقيًا لتقديمه
للطبيب أو للاطلاع عليه، والمختص قد يحتاج نسخة موقعة.
قاعدة البيانات تخزّن النصوص JSON، بينما هنا نعيدها
لصيغة ملف PDF جميل ومقروء.

متى يعمل؟
عند استقبال طلب GET إلى:
/api/supplements/assessments/<معرّف التقييم>/pdf

من يستدعي هذا الملف؟
صفحة التقييمات — زر «تحميل التقرير PDF».

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma (جداول SupplementAssessment و User و SwimmerProfile).
- generateSupplementPdfReport من services/pdf/supplement-pdf (يبني الـ PDF).
- SupplementAssessmentOutput من services/supplements/types (شكل البيانات).
- saveReportToDrive من lib/google-sync (نسخة احتياطية على Drive).

ترتيب العمل:
1. من المستخدم؟ غير مسجل → 401.
2. نقرأ معرّف التقييم من مسار الرابط ([id]).
3. نبحث عن التقييم بشرط ملكيته للمستخدم → غير موجود → 404.
4. نجلب بيانات السباح (الاسم، الجنس، العمر، الوزن).
5. نحوّل الحقول النصية JSON إلى كائنات صالحة (دالة parse).
6. نولّد الـ PDF عبر generateSupplementPdfReport.
7. نرفع نسخة للـ Google Drive (بلا انتظار النتيجة).
8. نرجع الرد بملف PDF للتحميل.
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
// generateSupplementPdfReport: دالة محلية من services/pdf/supplement-pdf
// تبني محتوى الـ PDF وتحوّله إلى Buffer (بايتات).
import { generateSupplementPdfReport } from '@/services/pdf/supplement-pdf';
// SupplementAssessmentOutput: نوع TypeScript محلي يصف شكل
// نتيجة التقييم النهائية قبل طباعتها في الـ PDF.
import type { SupplementAssessmentOutput } from '@/services/supplements/types';
// saveReportToDrive: دالة محلية من lib/google-sync ترفع
// الملف إلى Google Drive بشكل غير متزامن.
import { saveReportToDrive } from '@/lib/google-sync';

// ========================================
// 2. دالة مساعدة لقراءة النصوص JSON
// ========================================

// parse: دالة مساعدة (ليست واجهة API). قاعدة البيانات تخزّن
// الكائنات كنص JSON، وهنا نعيد تحويل النص إلى كائن.
// T: نوع الكائن المتوقع (مثل قائمة توصيات).
// raw: النص المخزّن. fallback: القيمة الاحتياطية لو النص فارغ
// أو غير صالح (مثل قائمة فارغة أو null).
function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ========================================
// 3. معالج إنشاء الـ PDF
// ========================================

// RouteContext: يصف معطيات المسار. في Next.js الجديد تكون
// params وعودًا (Promise) نحتاج انتظاره لقراءة معرّف [id].
type RouteContext = { params: Promise<{ id: string }> };

// GET: اسم الدالة = نوع الطلب. _req: الطلب (لا نستخدمه —
// البادئة _ تعني متغير غير مستخدم). ctx: يحتوي معرّف التقييم.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معرّف التقييم من مسار الرابط.
  const { id } = await ctx.params;

  // الخطوة 3: البحث عن التقييم — بشرط أنه يخصّ المستخدم نفسه
  // (userId: user.id) حتى لا يطّلع أحد على تقييمات غيره.
  const assessment = await prisma.supplementAssessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  // الخطوة 4: جلب بيانات السباح لعرضها في الـ PDF.
  // dbUser: بيانات الحساب. profile: ملف السباح الرياضي.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const profile = await prisma.swimmerProfile.findFirst({ where: { userId: user.id } });

  // الخطوة 5: تجميع كل بيانات التقييم في كائن output.
  // الحقول التقييمية (coverage/eligibility/...) نصوص JSON
  // في القاعدة — نحولها بكائنات عبر parse ليعرضها الـ PDF.
  // summary: ملخص نصي — فارغ حاليًا.
  const output: SupplementAssessmentOutput = {
    version: assessment.version,
    overallLevel: (assessment.overallLevel ?? 'none') as SupplementAssessmentOutput['overallLevel'],
    needsMedicalApproval: assessment.needsMedicalApproval,
    needsGuardianConsent: assessment.needsGuardianConsent,
    needsLabTest: assessment.needsLabTest,
    coverage: parse(assessment.coverage, []),
    eligibility: parse(assessment.eligibility, []),
    proteinGap: parse(assessment.proteinGap, null),
    hydration: parse(assessment.hydration, null),
    recommendations: parse(assessment.recommendations, []),
    schedule: parse(assessment.schedule, []),
    foodAlternatives: parse(assessment.foodAlternatives, []),
    summary: '',
  };

  // الخطوة 6: توليد الـ PDF الفعلي.
  // athleteName: اسم السباح (من الحساب أو الملف، ولو لا يوجد
  // نضع كلمة «سباح»). issueDate: تاريخ الإصدار بصيغة مصرية.
  const buffer = await generateSupplementPdfReport({
    athleteName: dbUser?.name ?? profile?.fullName ?? 'سباح',
    gender: profile?.gender ?? 'male',
    age: profile?.age ?? null,
    weightKg: profile?.weightKg ?? null,
    issueDate: new Date(assessment.createdAt).toLocaleDateString('ar-EG'),
    version: assessment.version,
    assessment: output,
  });

  // الخطوة 7: نسخة احتياطية على Google Drive.
  // base64: نرسل محتوى الملف نصيًا مشفرًا بهذه الصيغة.
  // .catch(() => {}): لو فشل الرفع لا نعطّل التحميل (نادي الشتلة).
  saveReportToDrive({
    swimmerName: dbUser?.name ?? profile?.fullName ?? 'سباح',
    kind: 'supplement',
    fileName: `supplement-assessment-${assessment.id}.pdf`,
    mimeType: 'application/pdf',
    base64: buffer.toString('base64'),
  }).catch(() => {});

  // الخطوة 8: إرسال ملف PDF للمتصفح.
  // Content-Type: نوع الملف (PDF). Content-Disposition: attachment
  // يعني «حمّله كملف ولا تعرضه في الصفحة».
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="supplement-assessment-${assessment.id}.pdf"`,
    },
  });
}
