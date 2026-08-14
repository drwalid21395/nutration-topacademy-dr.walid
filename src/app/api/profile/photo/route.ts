/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/profile/photo/route.ts

وظيفة الملف:
واجهة API بحرف POST لرفع الصورة الشخصية للسباح:
تحفظها محليًا عند توفره (بيئة التطوير)، وتنسخها إلى
Google Drive للتوثيق، وتحدّث حقل الصورة في جدول User —
مع خطة احتياطية (data URI) تضمن ظهور الصورة دائمًا.

لماذا نحتاجه؟
صفحة الملف الشخصي تسمح بتغيير الصورة؛ هذا الملف يستقبل
الصورة ويخزّنها ويحدّثها في الحساب لتظهر في كل التطبيق.

متى يعمل؟
عند وصول طلب POST إلى /api/profile/photo.

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نقرأ الصورة ونتحقق من صيغتها وحجمها (≤ 2MB) → 422.
4. نحاول الحفظ محليًا (على Vercel نظام الملفات للقراءة فقط فيفشل).
5. نسخة احتياطية في Google Drive (اختيارية).
6. إن فشل الحفظ المحلي → نستخدم data URI المضمّنة.
7. نحدّث حقل الصورة في جدول User ونرجع الرابط النهائي.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: صورة غير صالحة/كبيرة.
- 429: طلبات كثيرة.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- rateLimit من lib/security.
- syncToGoogleDrive من lib/google-sync.
- writeFile/mkdir من fs/promises + path من Node.js.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// writeFile/mkdir: من مكتبة fs/promises (أدوات النظام في Node.js)
// — لكتابة ملف الصورة على القرص وإنشاء المجلدات.
import { writeFile, mkdir } from 'fs/promises';
// path: من مكتبة path — لبناء مسار مجلد الصور بشكل صحيح.
import path from 'path';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول.
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// rateLimit: ملف محلي من lib/security — منع الطلبات الكثيرة.
import { rateLimit } from '@/lib/security';
// syncToGoogleDrive: من lib/google-sync — نسخة احتياطية للصورة في درايف.
import { syncToGoogleDrive } from '@/lib/google-sync';

// ========================================
// 2. الثوابت
// ========================================

// أقصى حجم للصورة الشخصية = 2 ميجابايت (2 × 1024 × 1024 بايت).
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

// ========================================
// 3. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/profile/photo.
// req: كائن الطلب الواصل (يحوي الصورة بصيغة data URI).
/**
 * رفع صورة السباح الشخصية.
 * يحفظ محليًا عند توفره (بيئة التطوير)، وينسخها إلى Google Drive
 * (فولدر السباح) لتبقى متاحة على الإنتاج، ثم يحدّث حقل الصورة في الحساب.
 */
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع الطلبات الكثيرة — 10 طلبات في الدقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`avatar:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON) واستخراج الصورة.
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // التحقق أن الصورة تبدأ بالصيغة الصحيحة (data:image/...).
  if (!body.image || !body.image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'صورة غير صالحة' }, { status: 422 });
  }

  // split(',')[1]: نأخذ الجزء المشفّر base64 بعد الفاصلة.
  // Buffer.from(base64, 'base64'): فك الترميز إلى بايتات فعلية.
  const raw = body.image.split(',')[1];
  const bytes = Buffer.from(raw, 'base64');
  // لو الحجم يتجاوز 2 ميجابايت → 422.
  if (bytes.length > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'حجم الصورة يتجاوز 2 ميجابايت' }, { status: 422 });
  }

  // الخطوة 4: تحديد نوع الملف (MIME) والامتداد من محتوى الصورة
  // (png → png، webp → webp، غير ذلك → jpeg).
  const mime = body.image.includes('image/png')
    ? 'image/png'
    : body.image.includes('image/webp')
      ? 'image/webp'
      : 'image/jpeg';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  // اسم الملف = معرّف المستخدم (صورة واحدة لكل مستخدم تُستبدل عند كل رفع).
  const filename = `${user.id}.${ext}`;

  // متغيرات للرابط النهائي وعلامة نجاح الحفظ المحلي.
  let imageUrl = '';
  let localSaved = false;

  // الخطوة 5: الحفظ محليًا (إن أمكن).
  try {
    // مسار مجلد الصور: public/uploads/avatars.
    const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(dir, { recursive: true }); // إنشاء المجلد إن لم يوجد.
    await writeFile(path.join(dir, filename), bytes); // كتابة الملف.
    const storageBase = process.env.STORAGE_BASE_URL ?? '';
    imageUrl = `${storageBase}/uploads/avatars/${filename}`;
    localSaved = true;
  } catch {
    // على Vercel (نظام ملفات للقراءة فقط) نعتمد على التخزين المضمّن
  }

  // الخطوة 6: نسخة احتياطية في Google Drive (فولدر السباح) — للتوثيق فقط ولا تُعتمد كرابط عرض
  // لأن ملفات درايف قد لا تكون مشتركة برابط عام فتعطي صورة معطوبة.
  try {
    await syncToGoogleDrive({
      type: 'avatar',
      data: { swimmerName: user.name },
      photos: [{ fileName: filename, mimeType: mime, base64: raw, folder: 'avatars' }],
    });
  } catch {
    // درايف اختياري
  }

  // الخطوة 7: الخطة المضمونة — لو فشل الحفظ المحلي نُضمّن الصورة
  // نفسها داخل الرابط (data URI) فتعرض دائمًا وبوضوح تام،
  // الصورة المضمونة: التخزين المضمّن (data URI) يعرض دائمًا وبوضوح تام
  // مهما فشل التخزين المحلي أو درايف — خاصةً على الإنتاج.
  if (!localSaved) {
    imageUrl = `data:${mime};base64,${raw}`;
  }

  // الخطوة 8: تحديث حقل الصورة في جدول User بالرابط النهائي.
  await prisma.user.update({ where: { id: user.id }, data: { image: imageUrl } });

  return NextResponse.json({ ok: true, image: imageUrl });
}
