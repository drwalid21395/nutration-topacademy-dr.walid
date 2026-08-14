/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/approve/route.ts

وظيفة الملف:
واجهة API بحرف POST تتيح للمختص/المدرب/المدير اعتماد
تقييم المكملات أو رفضه أو تعديله، وتسجل القرار في جدول
SupplementApproval ثم تحدّث حالة التقييم في جدول
SupplementAssessment.

لماذا نحتاجه؟
المحرك يحسب التقييم تلقائيًا بحالة needs-review، ولكن
يجب أن يقرّه إنسان مؤهل (أخصائي تغذية أو مدرب أو مدير)
قبل العمل به. هذا الملف هو مكان اتخاذ هذا القرار.

متى يعمل؟
عند استقبال طلب POST إلى /api/supplements/approve.

من يستدعي هذا الملف؟
واجهة مراجعة تقييمات المكملات الخاصة بالمختصين
(لوحة المختص/المدرب/المدير).

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth للتحقق من تسجيل الدخول والدور.
- prisma من lib/prisma: جدول SupplementAssessment (التقييم)
  وجدول SupplementApproval (سجل القرار).

ترتيب العمل:
1. من المستخدم؟ غير مسجل → 401.
2. هل الدور dietitian/coach/admin؟ لا → 403.
3. نقرأ جسم الطلب JSON.
4. نتحقق من وجود assessmentId و action صالح → 422.
5. نبحث عن التقييم → غير موجود → 404.
6. ننشئ سجل الاعتماد في SupplementApproval.
7. نحدّث حالة التقييم بنفس القرار.
8. نرجع 201 مع سجل الاعتماد.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي
// أو null لو غير مسجل.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب به الجداول.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. معالج اعتماد التقييم
// ========================================

/**
 * POST: اعتماد/رفض/تعديل تقييم المكملات.
 * متاح فقط للأدوار: dietitian (أخصائي تغذية) / coach (مدرب) / admin (مدير).
 * 201 (Created) = تم إنشاء سجل الاعتماد بنجاح.
 */
// export async function POST: اسم الدالة = نوع الطلب.
// Next.js يستدعي POST تلقائيًا عند وصول طلب POST لهذا المسار.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: تحقق من الدور.
  // user.role: هل المستخدم من الأدوار المخوّلة؟
  // 403: ممنوع — التسجيل موجود لكن الصلاحية غير كافية.
  if (!['dietitian', 'coach', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'غير مسموح لهذا الدور' }, { status: 403 });
  }

  // الخطوة 3: قراءة جسم الطلب (المُرسَل من الواجهة).
  // assessmentId: معرّف التقييم. action: القرار (approved/rejected/adjusted).
  // notes: ملاحظة المختص. signature: توقيعه الاختياري.
  let body: { assessmentId?: string; action?: string; notes?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    // لو جسم الطلب ليس JSON صالحًا → 400 (طلب خاطئ).
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: تحقق من صحة الإدخال.
  // action يجب أن تكون واحدة من ثلاث قيم معروفة.
  // 422: البيانات غير مكتملة أو غير منطقية.
  if (!body.assessmentId || !['approved', 'rejected', 'adjusted'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'التقييم والإجراء مطلوبان' }, { status: 422 });
  }

  // الخطوة 5: البحث عن التقييم المطلوب.
  // findUnique: نبحث بمعرّف فريد فقط. غير موجود → 404.
  const assessment = await prisma.supplementAssessment.findUnique({ where: { id: body.assessmentId } });
  if (!assessment) return NextResponse.json({ error: 'التقييم غير موجود' }, { status: 404 });

  // الخطوة 6: حفظ القرار كسجل جديد في جدول SupplementApproval.
  // approverId: من اتخذ القرار. action: نوع القرار.
  // notes/signature: ننظفها من الفراغات ونخزن null لو فارغة.
  const approval = await prisma.supplementApproval.create({
    data: {
      assessmentId: assessment.id,
      approverId: user.id,
      action: body.action as 'approved' | 'rejected' | 'adjusted',
      notes: body.notes?.trim() || null,
      signature: body.signature?.trim() || null,
    },
  });

  // الخطوة 7: تحديث حالة التقييم نفسها لتصبح مطابقة للقرار.
  // لو القرار approved تصبح الحالة approved وهكذا.
  await prisma.supplementAssessment.update({
    where: { id: assessment.id },
    data: { status: body.action },
  });

  // الخطوة 8: إرسال الرد مع سجل الاعتماد.
  // 201 = تم الإنشاء بنجاح.
  return NextResponse.json({ ok: true, approval }, { status: 201 });
}
