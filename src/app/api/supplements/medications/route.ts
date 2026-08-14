/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/medications/route.ts

وظيفة الملف:
واجهة API لإدارة الأدوية التي يتناولها السباح:
- GET: قراءة قائمة الأدوية المسجلة.
- POST: إضافة دواء جديد (الاسم، الغرض، الجرعة، التكرار).
- DELETE: حذف دواء (لمالكه فقط).

لماذا نحتاجه؟
المكملات قد تتعارض مع الأدوية. وجود سجل واضح بالأدوية
يمكّن محرك التقييم والمختص من منع التوصيات الخطيرة
أو التنبيه عند وجود تعارض محتمل.

متى يعمل؟
عند طلبات GET/POST/DELETE إلى /api/supplements/medications.

من يستدعي هذا الملف؟
صفحة إدارة الأدوية داخل لوحة المكملات.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول Medication.

ترتيب العمل (GET):
1. غير مسجل → 401. 2. نجلب أدوية المستخدم (الأحدث أولًا).

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو غير صالح.
3. اسم الدواء مطلوب → 422 لو غائب.
4. نحفظ الدواء ونرجع 201.

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
// 2. معالج القراءة (GET)
// ========================================

// GET: قراءة قائمة أدوية المستخدم (الأحدث إضافةً أولًا).
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب الأدوية بشرط أنها تخص هذا المستخدم فقط.
  const medications = await prisma.medication.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ medications });
}

// ========================================
// 3. معالج الإضافة (POST)
// ========================================

// POST: إضافة دواء جديد في جدول Medication.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // name: اسم الدواء (إلزامي). purpose: لماذا يؤخذ؟
  // dosage: الجرعة. frequency: كم مرة (مثل يوميًا).
  let body: { name?: string; purpose?: string; dosage?: string; frequency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: فحص اسم الدواء — لابد منه → 422 لو غائب.
  if (!body.name?.trim()) return NextResponse.json({ error: 'اسم الدواء مطلوب' }, { status: 422 });

  // الخطوة 4: الحفظ مع تنظيف النصوص من الفراغات.
  // الحقول الاختيارية الفارغة تُخزَّن null.
  const medication = await prisma.medication.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      purpose: body.purpose?.trim() || null,
      dosage: body.dosage?.trim() || null,
      frequency: body.frequency?.trim() || null,
    },
  });
  // الخطوة 5: إرسال الرد مع الدواء المحفوظ. 201 = تم الإنشاء.
  return NextResponse.json({ ok: true, medication }, { status: 201 });
}

// ========================================
// 4. معالج الحذف (DELETE)
// ========================================

// DELETE: حذف دواء — بشرط ملكية المستخدم له.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معامل id من الرابط. بدونه → 422.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  // الخطوة 3: التأكد أن الدواء موجود ويملكه المستخدم → وإلا 404.
  const existing = await prisma.medication.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'الدواء غير موجود' }, { status: 404 });

  // الخطوة 4: الحذف الفعلي من قاعدة البيانات.
  await prisma.medication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
