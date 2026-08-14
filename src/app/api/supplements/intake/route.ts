/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/intake/route.ts

وظيفة الملف:
واجهة API لسجل «الالتزام بتناول المكملات» (Intake Log):
- GET: قراءة آخر 60 سجل التزام للمستخدم.
- POST: تسجيل سجل جديد (أي مكمل، كم جرعة، متى، مع طعام؟
  وهل التزم؟ مع أعراض وملاحظات طاقية).

لماذا نحتاجه؟
الالتزام الفعلي بالمكملات أهم من التوصية ذاتها. هذا السجل
يتيح للسباح متابعة نفسه وللمختص معرفة هل يلتزم السباح
بخطة المكملات وما الأعراض التي ظهرت عليه.

متى يعمل؟
عند طلبات GET/POST إلى /api/supplements/intake.

من يستدعي هذا الملف؟
صفحة «سجل الالتزام بالمكملات» داخل لوحة المكملات.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول SupplementIntakeLog (السجلات).

ترتيب العمل (GET):
1. غير مسجل → 401.
2. نجلب آخر 60 سجلًا (الأحدث أولًا) ونرجعها.

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو JSON غير صالح.
3. لابد من اسم المكمل والجرعة → 422 لو ناقصة.
4. نحفظ السجل مع تنظيف الحقول.
5. نرجع 201.
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

// ========================================
// 2. معالج القراءة (GET)
// ========================================

// GET: قراءة سجلات الالتزام الخاصة بالمستخدم.
// نرجع آخر 60 سجلًا فقط (take) مرتبة من الأحدث (logDate desc).
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب السجلات — بشرط أنها تخص هذا المستخدم فقط.
  const logs = await prisma.supplementIntakeLog.findMany({
    where: { userId: user.id },
    orderBy: { logDate: 'desc' },
    take: 60,
  });
  return NextResponse.json({ logs });
}

// ========================================
// 3. معالج الحفظ (POST)
// ========================================

// POST: تسجيل سجل التزام جديد بمكمل.
// يخزن بيانات الجرعة، وقت التناول، مستوى الطاقة، جودة النوم،
// التعافي، الأداء، الأعراض، وتغير الوزن — ليُحلل كله لاحقًا.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // كل الحقول اختيارية ماعدا اسم المكمل والجرعة ووحدتها.
  // energyLevel/sleepQuality/recoveryLevel/performanceLevel:
  // تقييمات ذاتي من 1 إلى ... يختارها السباح.
  let body: {
    productId?: string | null;
    supplementName?: string;
    doseAmount?: number;
    doseUnit?: string;
    timeTaken?: string | null;
    withFood?: boolean;
    compliant?: boolean;
    sideEffects?: string;
    energyLevel?: number | null;
    sleepQuality?: number | null;
    recoveryLevel?: number | null;
    performanceLevel?: number | null;
    stomachIssues?: string;
    weightChangeKg?: number | null;
    athleteNotes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: فحص الحقول الأساسية.
  // doseAmount يجب أن يكون رقمًا فعليًا (typeof === 'number').
  // 422: بيانات غير مكتملة.
  if (!body.supplementName?.trim() || typeof body.doseAmount !== 'number' || !body.doseUnit?.trim()) {
    return NextResponse.json({ error: 'اسم المكمل والجرعة مطلوبة' }, { status: 422 });
  }

  // الخطوة 4: حفظ السجل في جدول SupplementIntakeLog.
  // ننظف النصوص من الفراغات (trim) ونحوّل null للحقول الفارغة.
  // timeTaken: نص زمني يتحول إلى كائن Date. logDate: الآن.
  // ?? : مشغل «إما أو» — لو القيمة فارغة نستخدم البديل.
  const log = await prisma.supplementIntakeLog.create({
    data: {
      userId: user.id,
      productId: body.productId ?? null,
      supplementName: body.supplementName.trim(),
      doseAmount: body.doseAmount,
      doseUnit: body.doseUnit.trim(),
      timeTaken: body.timeTaken ? new Date(body.timeTaken) : null,
      withFood: body.withFood ?? true,
      compliant: body.compliant ?? true,
      sideEffects: body.sideEffects?.trim() || null,
      energyLevel: body.energyLevel ?? null,
      sleepQuality: body.sleepQuality ?? null,
      recoveryLevel: body.recoveryLevel ?? null,
      performanceLevel: body.performanceLevel ?? null,
      stomachIssues: body.stomachIssues?.trim() || null,
      weightChangeKg: body.weightChangeKg ?? null,
      athleteNotes: body.athleteNotes?.trim() || null,
      logDate: new Date(),
    },
  });
  // الخطوة 5: إرسال الرد مع السجل المحفوظ. 201 = تم الإنشاء.
  return NextResponse.json({ ok: true, log }, { status: 201 });
}
