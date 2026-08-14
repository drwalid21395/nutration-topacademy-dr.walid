/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/plan/[id]/pdf/route.ts

وظيفة الملف:
واجهة API بحرف GET تولّد ملف PDF جميل للخطة الغذائية
(جدول الوجبات + قائمة مشتريات + إرشادات سلامة)، وتحفظ
نسخة في Google Drive، وترجع الملف للمتصفح للتحميل.

لماذا نحتاجه؟
زر "تحميل الخطة PDF" يفتح هذا الرابط ليتحمّل السباح خطته
ويطبعها أو يشاركها — إضافة إلى أرشفة نسخة في درايف.

متى يعمل؟
عند وصول طلب GET إلى:
/api/plan/<معرّف الخطة>/pdf
مع معاملات اختيارية:
- ?mode=brief → نسخة مختصرة (اليوم الأول فقط).
- ?supplements=1 → إضافة قسم المكملات التثقيفي.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. نقرأ معرّف الخطة من الرابط (params).
3. نجلب الخطة بوجباتها ومكوناتها، ونتأكد أنها تخص المستخدم → 404.
4. نبني بيانات الـ PDF (معلومات السباح + وجبات + قائمة مشتريات).
5. نولّد الملف عبر buildPlanPdf، نحفظ نسخة في درايف.
6. نرجع الملف كمرفق تحميل (Content-Disposition: attachment).

ماذا يعني HTTP Status؟
- 200: نجاح (ملف PDF). 401: غير مسجل.
- 404: الخطة غير موجودة. 500: فشل في توليد الملف.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- buildPlanPdf من services/pdf/plan-pdf.
- formatDate + formatNumber من lib/utils.
- SWIMMER_LEVELS + GOALS + PLAN_TYPES من lib/constants.
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
// buildPlanPdf: من services/pdf/plan-pdf — الدالة التي تبني
// مستند PDF الفعلي من بيانات الخطة.
import { buildPlanPdf } from '@/services/pdf/plan-pdf';
// formatDate + formatNumber: من lib/utils — دوال مساعدة لتهيئة
// التواريخ والأرقام بشكل عربي أنيق داخل الـ PDF.
import { formatDate, formatNumber } from '@/lib/utils';
// SWIMMER_LEVELS + GOALS + PLAN_TYPES: من lib/constants —
// جداول تحويل القيم المشفرة إلى نصوص عربية (مستوى، هدف، نوع خطة).
import { SWIMMER_LEVELS, GOALS, PLAN_TYPES } from '@/lib/constants';
// saveReportToDrive: من lib/google-sync — حفظ نسخة من الملف في Google Drive.
import { saveReportToDrive } from '@/lib/google-sync';

// ========================================
// 2. نوع سياق المسار + المهلة
// ========================================

// RouteContext: وصف معاملات المسار الديناميكي.
// [id] في المجلد يعني أن الرابط يحمل معرّفًا نحتاجه،
// وهو Promise (وعد) يُفك بـ await.
type RouteContext = { params: Promise<{ id: string }> };

// maxDuration = 60: يرفع الحد الأقصى لمدة تنفيذ هذه الدالة إلى 60 ثانية.
// PDF للخطط الطويلة (30 يومًا) قد يستغرق عدة ثوانٍ — ارفع المهلة.
// (بدون هذا السطر، قد يقطع Vercel الطلب قبل انتهاء التوليد).
export const maxDuration = 60;

// ========================================
// 3. معالج الطلب GET (توليد PDF)
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET إلى هذا المسار.
// req: كائن الطلب (نقرأ منه معاملات الرابط الاختيارية).
// ctx: يحوي معرّف الخطة من الرابط — نقرؤه عبر await ctx.params.
export async function GET(req: NextRequest, ctx: RouteContext) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: استخراج معرّف الخطة من الرابط.
  const { id } = await ctx.params;

  // الخطوة 3: نجلب الخطة بكل وجباتها ومكوناتها، ونتأكد أنها تخص
  // هذا المستخدم (userId في الشرط — لا تحميل خطط الآخرين).
  const plan = await prisma.mealPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      meals: { include: { items: true }, orderBy: { dayNumber: 'asc' } },
      user: { select: { name: true, image: true } },
    },
  });

  if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 });

  // ملف السباح المرتبط بالخطة (لبياناته الشخصية في الـ PDF).
  const profile = plan.profileId
    ? await prisma.swimmerProfile.findUnique({ where: { id: plan.profileId } })
    : null;

  // الخطوة 4: قراءة معاملات الرابط الاختيارية.
  const url = new URL(req.url);
  const brief = url.searchParams.get('mode') === 'brief'; // نسخة مختصرة؟
  const includeSupplements = url.searchParams.get('supplements') === '1'; // قسم المكملات؟

  // shopping: مجموعة (Set) لتجميع أسماء الأطعمة الفريدة في قائمة المشتريات
  // (Set يمنع تكرار نفس الطعام عدة مرات).
  const shopping = new Set<string>();
  // safetyNotes: إرشادات سلامة الغذاء الثابتة في كل ملف.
  const safetyNotes = [
    'احفظ اللحوم والدواجن المطبوخة في الثلاجة (4°م أو أقل) واستهلكها خلال 3-4 أيام.',
    'لا تترك الطعام في درجة حرارة الغرفة أكثر من ساعتين.',
    'أعد تسخين الوجبات المجمدة حتى تصل لحرارة عالية قبل الأكل.',
    'افصل اللحوم النيئة عن المطبوخة لمنع التلوث المتبادل.',
  ];

  // الخطوة 5: تجهيز الوجبات للعرض في الـ PDF.
  // filter: في النسخة المختصرة نأخذ اليوم الأول فقط (dayNumber === 1).
  // map: نحول كل وجبة إلى الشكل البسيط المطلوب للطباعة.
  // داخل كل وجبة: نستبعد البدائل (isAlternative) ونضيف طعامها
  // لقائمة المشتريات (shopping.add).
  const meals = plan.meals
    .filter((m) => (brief ? m.dayNumber === 1 : true))
    .map((m) => ({
      day: m.dayNumber,
      type: m.mealType,
      title: m.title,
      timing: m.timing ?? '',
      calories: m.calories,
      note: m.note ?? undefined,
      items: m.items
        .filter((it) => !it.isAlternative)
        .map((it) => {
          shopping.add(it.foodNameAr);
          return { name: it.foodNameAr, qty: it.quantity ?? `${it.grams ?? ''} جم`, cals: Math.round(it.calories ?? 0) };
        }),
    }));

  // قسم المكملات: نص تثقيفي فقط (لا يُعرض إلا لو طُلب supplements=1).
  const supplementNames = includeSupplements
    ? ['تثقيفي فقط: البروتين، الكرياتين (للبالغين بإشراف مختص)، الكافيين (بحذر)، الإلكتروليتات، فيتامين D والحديد (عند نقص مثبت بالفحص)، أوميجا 3، الكالسيوم، المغنيسيوم.']
    : [];

  // الخطوة 6: تجميع كل بيانات الـ PDF في كائن واحد.
  // تتحول القيم المشفرة (مثل goal و level) إلى نصوص عربية
  // عبر جداول constants، وإلا تُعرض القيمة الخام.
  const pdfData = {
    swimmerName: profile?.fullName ?? plan.user.name ?? '',
    issueDate: formatDate(plan.createdAt),
    planDuration: PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? `${plan.durationDays} يوم`,
    goal: plan.goal ? GOALS[plan.goal as keyof typeof GOALS] ?? plan.goal : undefined,
    gender: profile?.gender === 'female' ? 'أنثى' : 'ذكر',
    age: profile?.age ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    level: profile?.swimmerLevel ? SWIMMER_LEVELS[profile.swimmerLevel as keyof typeof SWIMMER_LEVELS] : undefined,
    swimSessions: profile?.swimSessionsPerWeek ?? null,
    gymSessions: profile?.gymSessionsPerWeek ?? null,
    calories: plan.totalCalories,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    waterMl: plan.waterMl,
    meals,
    shoppingList: Array.from(shopping), // تحويل المجموعة إلى قائمة.
    alternativesNote: 'يمكن استبدال أي مكوّن ببديل مماثل من نفس المجموعة الغذائية مع مراعاة الحساسية المسجلة والنظام الغذائي المختار.',
    // نصائح خاصة بخطة البطولة لو كانت الخطة وضعًا تنافسيًا.
    competitionNotes: plan.isCompetitionMode
      ? [
          'الأسبوع السابق: ثبّت مواعيد الوجبات ولا تجرّب أطعمة أو مكملات جديدة.',
          'قبل السباق بـ 3-4 ساعات: وجبة مألوفة منخفضة الدهون والألياف.',
          'بين السباقات: وجبات صغيرة سريعة الهضم وتعويض السوائل.',
          'بعد كل سباق: بروتين + كربوهيدرات سريعة خلال 30 دقيقة.',
        ]
      : undefined,
    safetyNotes,
    version: `1.${plan.version}`,
    planUrl: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/plan/${plan.id}`,
    includeSupplements,
    supplementsSection: supplementNames,
  };

  // الخطوة 7: توليد الملف الفعلي.
  try {
    // buildPlanPdf: يبني مستند PDF ويعيده كبايتات.
    const pdf = await buildPlanPdf(pdfData);
    // نسخة احتياطية في Google Drive (اختيارية — أي خطأ يُتجاهل).
    saveReportToDrive({
      swimmerName: profile?.fullName ?? plan.user.name ?? 'سباح',
      kind: 'plan',
      fileName: `plan-${plan.id}.pdf`,
      mimeType: 'application/pdf',
      base64: pdf.toString('base64'),
    }).catch(() => {});
    // إرجاع الملف كمرفق تحميل:
    // Content-Type: نوع الملف (PDF).
    // Content-Disposition: attachment + filename: يجعل المتصفح
    // يبدأ تحميل الملف باسم plan-<id>.pdf بدل فتحه في نافذة.
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="plan-${plan.id}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    // أي خطأ أثناء التوليد → 500 مع رسالة الخطأ.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'تعذر إنشاء PDF' },
      { status: 500 }
    );
  }
}
