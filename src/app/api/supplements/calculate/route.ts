/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/calculate/route.ts

وظيفة الملف:
واجهة API بحرف POST تستقبل بيانات السباح الغذائية والرياضية
وترسلها إلى محرك تقييم المكملات، ثم تعيد النتيجة كاملة
(التوصيات، الجرعات، مستوى الأهلية، التنبيهات الطبية...).
هذا الملف لا يحفظ شيئًا في قاعدة البيانات — هو حساب فقط.

لماذا نحتاجه؟
هذا هو «المحرك» الذي يقرر أي مكمل يناسب السباح وبأي جرعة،
على أساس الطول والوزن والعمر والتدريبات ونتائج المعامل.

متى يعمل؟
عند استقبال طلب POST إلى /api/supplements/calculate.

من يستدعي هذا الملف؟
صفحة حاسبة المكملات — عند الضغط على زر «احسب التقييم».

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- generateSupplementAssessment من services/supplements/assessment
  (هي التي تجري الحساب العلمي فعليًا).
- نوع SupplementAssessmentInput من services/supplements/types
  (يصف شكل البيانات القادمة من الواجهة).

ترتيب العمل:
1. من المستخدم؟ غير مسجل → 401.
2. نقرأ بيانات الإدخال JSON → غير صالح → 400.
3. نتأكد أن الإدخال كائن غير فارغ → 400.
4. نستدعي محرك التقييم generateSupplementAssessment.
5. لو نجح → نرجع النتيجة. لو فشل → نرجع 422.
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
// generateSupplementAssessment: دالة محلية من services/supplements/assessment
// هي محرك الحساب الذي يفحص المدخلات ويصدر التقييم الكامل.
import { generateSupplementAssessment } from '@/services/supplements/assessment';
// SupplementAssessmentInput: نوع TypeScript محلي يصف شكل البيانات
// التي يجب أن يرسلها المستخدم (الطول، الوزن، التدريبات...).
import type { SupplementAssessmentInput } from '@/services/supplements/types';

// ========================================
// 2. معالج الحساب (POST)
// ========================================

// POST: حساب تقييم المكملات من بيانات مرسلة، دون حفظ أي شيء.
// النتيجة تُعرض للسباح لمراجعتها ثم تُحفظ عبر مسار آخر لو وافق.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب وتحويله إلى نوع الإدخال المتوقع.
  let input: SupplementAssessmentInput;
  try {
    input = (await req.json()) as SupplementAssessmentInput;
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: فحص أولي — لابد أن يكون كائنًا فعليًا.
  // (لو أُرسل نص أو رقم مثلًا نرفضه مبكرًا قبل المحرك.)
  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: استدعاء المحرك داخل try/catch.
  // النتيجة قد تفشل لو البيانات غير منطقية (مثل عمر أو وزن مستحيل).
  try {
    const result = generateSupplementAssessment(input);
    // النجاح: نعيد النتيجة كاملة للواجهة.
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // الفشل: نسجل الخطأ في سجلات الخادم ونخبر المستخدم برسالة عامة.
    // 422: المدخلات غير صالحة منطقيًا.
    console.error('Supplement assessment error:', e);
    return NextResponse.json({ error: 'تعذر إكمال التقييم، تأكد من المدخلات' }, { status: 422 });
  }
}
