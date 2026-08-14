/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/context/route.ts

وظيفة الملف:
واجهة API بحرف GET تجمع في رد واحد «كل ما تحتاجه حاسبة
المكملات»: ملف السباح، أهدافه الغذائية، منتجاته، أدويته،
نتائج معامله، وآخر تقييم له. بمعنى آخر: صورة شاملة للمستخدم.

لماذا نحتاجه؟
بدل أن ترسل حاسبة المكملات 6 طلبات منفصلة، ترسل طلبًا
واحدًا هنا ليأتي كل شيء في استجابة واحدة — أسرع وأبسط.

متى يعمل؟
عند استقبال طلب GET إلى /api/supplements/context (عادة مع
فتح صفحة حاسبة المكملات أو تحميلها مرة أخرى).

من يستدعي هذا الملف؟
صفحة حاسبة المكملات (لجلب البيانات اللازمة للحساب).

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جداول SwimmerProfile و NutritionTargets
  و SupplementProduct و Medication و LabResult و SupplementAssessment.

ترتيب العمل:
1. من المستخدم؟ غير مسجل → 401.
2. نجلب أحدث ملف سباح للمستخدم.
3. لو وُجد ملف → نجلب أحدث أهداف غذائية مرتبطة به.
4. نجلب (بالتوازي) المنتجات + الأدوية + نتائج المعامل + آخر تقييم.
5. نعيد كل شيء في استجابة JSON واحدة.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextResponse: أداة Next.js لإرسال الرد. من مكتبة next/server.
// نلاحظ عدم استيراد NextRequest — لأن هذا المسار لا يقرأ جسم طلب.
import { NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ به الجداول.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. معالج تجميع السياق (GET)
// ========================================

/** بيانات سياق حاسبة المكملات: الملف + الاحتياجات + المنتجات + الأدوية + التحاليل + آخر تقييم */
// GET: يعيد دفعة كاملة من بيانات المستخدم في استجابة واحدة.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب أحدث ملف سباح (ترتيبًا حسب آخر تحديث).
  const profile = await prisma.swimmerProfile.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  // الخطوة 3: لو وُجد ملف → نجلب أحدث أهداف غذائية مرتبطة به.
  // (المستخدم قد لا يكون حفظ ملفًا بعد — وقتها targets = null.)
  const targets = profile
    ? await prisma.nutritionTargets.findFirst({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  // الخطوة 4: جلب أربع مجموعات بالتوازي.
  // Promise.all: نطلق الاستعلامات الأربعة معًا بدل واحد بعد الآخر —
  // فتُنفَّذ في وقت أقصر. النتيجة قائمة [products, medications, labResults, latestAssessment].
  const [products, medications, labResults, latestAssessment] = await Promise.all([
    // المنتجات التي سجّلها المستخدم (أحدثها أولًا).
    prisma.supplementProduct.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    // الأدوية المسجلة.
    prisma.medication.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    // نتائج المعامل (الأحدث تاريخًا أولًا).
    prisma.labResult.findMany({ where: { userId: user.id }, orderBy: { testDate: 'desc' } }),
    // آخر تقييم مكملات للمستخدم مع توصياته وبيانات الموافقين.
    prisma.supplementAssessment.findFirst({
      where: { userId: user.id },
      include: { recommendationItems: true, approvals: { include: { approver: { select: { id: true, name: true, role: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // الخطوة 5: تجميع كل شيء في استجابة واحدة.
  // user: نرسل بيانات أساسية فقط (id واسم ودور) — لا نرسل كلمة المرور إطلاقًا.
  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    profile,
    targets,
    products,
    medications,
    labResults,
    latestAssessment,
  });
}
