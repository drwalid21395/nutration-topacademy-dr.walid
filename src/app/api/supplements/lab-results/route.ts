/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/lab-results/route.ts

وظيفة الملف:
واجهة API لنتائج المعامل (التحاليل الطبية) الخاصة بمستخدم واحد:
- GET: قراءة كل نتائج التحاليل المسجلة.
- POST: تسجيل نتيجة تحليل جديدة (مثل فيتامين د أو الحديد).
- DELETE: حذف نتيجة تحليل (لصاحبها فقط).

لماذا نحتاجه؟
محرك تقييم المكملات يحتاج نتائج المعامل ليقرر بدقة: من كان
نقصه حقيقيًا يوصي بمكمل، ومن لا حاجة له يمتنع. بدون تحاليل
حقيقية لا يمكن اتخاذ قرار آمن.

متى يعمل؟
عند طلبات GET/POST/DELETE إلى /api/supplements/lab-results.

من يستدعي هذا الملف؟
صفحة إدخال نتائج المعامل داخل لوحة المكملات.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول LabResult.

ترتيب العمل (GET):
1. غير مسجل → 401. 2. نجلب كل نتائج المستخدم (الأحدث تاريخًا أولًا).

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو غير صالح.
3. لابد من التحليل والقيمة والوحدة → 422.
4. نترجم اسم التحليل إلى العربية تلقائيًا عبر MARKER_AR.
5. نحفظ النتيجة ونرجع 201.

ترتيب العمل (DELETE):
1. غير مسجل → 401. لا يوجد id → 422.
2. غير موجود → 404. 3. نحذف ونرجع ok.
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
// 2. قاموس ترجمة أسماء التحاليل
// ========================================

// MARKER_AR: قاموس ثابت يترجم رمز التحليل (مثل vitaminD)
// إلى اسمه بالعربية (فيتامين د). Record<string, string>:
// كائن مفاتيحه نصوص وقيمه نصوص.
const MARKER_AR: Record<string, string> = {
  hemoglobin: 'الهيموجلوبين',
  ferritin: 'فيريتين',
  iron: 'حديد',
  transferrin: 'ترانسفيرين',
  vitaminD: 'فيتامين د (25-OH)',
  b12: 'فيتامين ب12',
  folate: 'حمض الفوليك',
  calcium: 'كالسيوم',
  magnesium: 'مغنيسيوم',
  zinc: 'زنك',
  kidney: 'وظائف كلى',
  liver: 'وظائف كبد',
  thyroid: 'الغدة الدرقية',
  glucose: 'سكر الصائم',
};

// ========================================
// 3. معالج القراءة (GET)
// ========================================

// GET: قراءة كل نتائج المعامل للمستخدم (الأحدث تاريخًا أولًا).
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب النتائج بشرط أنها تخص المستخدم نفسه.
  const labResults = await prisma.labResult.findMany({
    where: { userId: user.id },
    orderBy: { testDate: 'desc' },
  });
  return NextResponse.json({ labResults });
}

// ========================================
// 4. معالج الحفظ (POST)
// ========================================

// POST: تسجيل نتيجة تحليل جديدة في جدول LabResult.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // marker: رمز التحليل. markerAr: الاسم بالعربية (اختياري —
  // لو لم يُرسل نستخرجه من القاموس). value: قيمة النتيجة.
  // unit: وحدة القياس. referenceRange: المدى الطبيعي المرجعي.
  let body: {
    marker?: string;
    markerAr?: string;
    value?: number;
    unit?: string;
    referenceRange?: string;
    testDate?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: فحص الحقول الأساسية (التحليل + القيمة + الوحدة).
  // 422: بيانات غير مكتملة.
  if (!body.marker || typeof body.value !== 'number' || !body.unit?.trim()) {
    return NextResponse.json({ error: 'التحليل والقيمة والوحدة مطلوبة' }, { status: 422 });
  }

  // الخطوة 4: الحفظ.
  // markerAr: الاسم العربي — من جسم الطلب أو من القاموس، ولو
  // التحليل غير معروف نحتفظ بالرمز نفسه كاسم.
  // testDate: تاريخ إجراء التحليل، ولو لم يُرسل نعتبره الآن.
  const labResult = await prisma.labResult.create({
    data: {
      userId: user.id,
      marker: body.marker,
      markerAr: body.markerAr ?? MARKER_AR[body.marker] ?? body.marker,
      value: body.value,
      unit: body.unit.trim(),
      referenceRange: body.referenceRange?.trim() || null,
      testDate: body.testDate ? new Date(body.testDate) : new Date(),
      notes: body.notes?.trim() || null,
    },
  });
  // الخطوة 5: إرسال الرد مع النتيجة المحفوظة. 201 = تم الإنشاء.
  return NextResponse.json({ ok: true, labResult }, { status: 201 });
}

// ========================================
// 5. معالج الحذف (DELETE)
// ========================================

// DELETE: حذف نتيجة تحليل — بشرط ملكية المستخدم لها.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معامل id من الرابط. بدونه → 422.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  // الخطوة 3: التأكد أن النتيجة موجودة ويملكها المستخدم → وإلا 404.
  const existing = await prisma.labResult.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'التحليل غير موجود' }, { status: 404 });

  // الخطوة 4: الحذف الفعلي من قاعدة البيانات.
  await prisma.labResult.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
