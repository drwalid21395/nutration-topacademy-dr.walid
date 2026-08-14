/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/supplements/products/route.ts

وظيفة الملف:
واجهة API لإدارة المنتجات التجارية من المكملات التي يسجلها
السباح (العبوة التي يشتريها فعلًا):
- GET: قراءة قائمة المنتجات المسجلة.
- POST: إضافة منتج جديد (الاسم، الماركة، المكونات، رقم الدفعة،
  تاريخ الصلاحية، مخاطر المنشطات...).
- DELETE: حذف منتج (لمالكه فقط).

لماذا نحتاجه؟
كثير من مخاطر المكملات تأتي من المنتجات المغشوشة أو الملوثة
بالمنشطات. تسجيل المنتج ورقم دفعه وفحصه الخارجي يسمح
للمختص بالتأكد من سلامة العبوة قبل اعتماد استخدامها.

متى يعمل؟
عند طلبات GET/POST/DELETE إلى /api/supplements/products.

من يستدعي هذا الملف؟
صفحة إدارة منتجات المكملات داخل لوحة المكملات.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول SupplementProduct.

ترتيب العمل (GET):
1. غير مسجل → 401. 2. نجلب منتجات المستخدم (الأحدث أولًا).

ترتيب العمل (POST):
1. غير مسجل → 401.
2. نقرأ الطلب → 400 لو غير صالح.
3. اسم المنتج مطلوب → 422 لو غائب.
4. نحفظ المنتج ونرجع 201.

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

// GET: قراءة قائمة منتجات المستخدم (الأحدث إضافةً أولًا).
export async function GET() {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: جلب المنتجات بشرط أنها تخص هذا المستخدم فقط.
  const products = await prisma.supplementProduct.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ products });
}

// ========================================
// 3. معالج الإضافة (POST)
// ========================================

// POST: إضافة منتج مكمل جديد في جدول SupplementProduct.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة جسم الطلب.
  // ingredients: قائمة مكونات (الاسم + الكمية + الوحدة).
  // batchVerified/thirdPartyTested: هل الدفعة موثقة؟ هل فُحصت
  // جهة خارجية؟ dopingRisk: تقييم خطر المنشطات.
  let body: {
    name?: string;
    brand?: string;
    ingredients?: { name: string; amount: number; unit: string }[];
    batchNumber?: string;
    batchVerified?: boolean;
    thirdPartyTested?: boolean;
    dopingRisk?: string;
    expiryDate?: string | null;
    dailyDose?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: فحص اسم المنتج — لابد منه → 422 لو غائب.
  if (!body.name?.trim()) return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 422 });

  // الخطوة 4: الحفظ مع تنظيف البيانات.
  // ingredientsJson: المكونات قائمة كائنات — تُخزَّن نص JSON
  // لأن العمود نصي. dopingRisk: القيمة الافتراضية 'unknown'
  // لو لم يُحدد. expiryDate: نص زمني يتحول إلى Date.
  const product = await prisma.supplementProduct.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      brand: body.brand?.trim() || null,
      ingredientsJson: body.ingredients?.length ? JSON.stringify(body.ingredients) : null,
      batchNumber: body.batchNumber?.trim() || null,
      batchVerified: body.batchVerified ?? false,
      thirdPartyTested: body.thirdPartyTested ?? false,
      dopingRisk: body.dopingRisk || 'unknown',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      dailyDose: body.dailyDose || null,
      notes: body.notes || null,
    },
  });
  // الخطوة 5: إرسال الرد مع المنتج المحفوظ. 201 = تم الإنشاء.
  return NextResponse.json({ ok: true, product }, { status: 201 });
}

// ========================================
// 4. معالج الحذف (DELETE)
// ========================================

// DELETE: حذف منتج — بشرط ملكية المستخدم له.
export async function DELETE(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: قراءة معامل id من الرابط. بدونه → 422.
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 422 });

  // الخطوة 3: التأكد أن المنتج موجود ويملكه المستخدم → وإلا 404.
  const existing = await prisma.supplementProduct.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

  // الخطوة 4: الحذف الفعلي من قاعدة البيانات.
  await prisma.supplementProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
