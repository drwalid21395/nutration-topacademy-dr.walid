/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/plan/status/route.ts

وظيفة الملف:
واجهة API بحرف GET بسيطة تجيب على سؤالين:
هل لدى المستخدم ملف سباح؟ وهل لديه أهداف غذائية محسوبة؟
(جوابان من نوع true/false).

لماذا نحتاجه؟
صفحة الخطط الغذائية تعرض للمستخدم مسارًا تدريجيًا:
"أولًا أدخل بياناتك، ثم احسب احتياجاتك، ثم أنشئ خطتك" —
هذا الملف يخبر الصفحة بأي مرحلة يقف المستخدم.

متى يعمل؟
عند وصول طلب GET إلى /api/plan/status.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. نعد سجلات ملف السباح وسجلات الأهداف لهذا المستخدم (بالتوازي).
3. نرجع نتيجتين منطقيتين: hasProfile / hasTargets.

ماذا يعني HTTP Status؟
- 200: نجاح. 401: غير مسجل.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextResponse: أداة Next.js لإرسال الرد. من مكتبة next/server.
import { NextResponse } from 'next/server';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';

// ========================================
// 2. معالج الطلب GET
// ========================================

// export async function GET:
// Next.js يستدعي GET تلقائيًا عند وصول طلب GET لهذا المسار.
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: نعد السجلات — عدّان متوازيان.
  // Promise.all: يشغّل الاستعلامين معًا (أسرع من التسلسل).
  // count: عدد ملفات السباح للمستخدم، وعدد الأهداف المرتبطة
  // بملفات هذا المستخدم (أي عبر العلاقة profile.userId).
  const [profileCount, targetsCount] = await Promise.all([
    prisma.swimmerProfile.count({ where: { userId: user.id } }),
    prisma.nutritionTargets.count({ where: { profile: { userId: user.id } } }),
  ]);

  // الخطوة 3: نحول العد إلى نتيجة منطقية (يوجد/لا يوجد).
  return NextResponse.json({
    hasProfile: profileCount > 0,
    hasTargets: targetsCount > 0,
  });
}
