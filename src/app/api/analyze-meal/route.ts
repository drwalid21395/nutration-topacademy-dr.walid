/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/analyze-meal/route.ts

وظيفة الملف:
واجهة API بحرف POST تحلل صورة وجبة بالذكاء الاصطناعي
(رؤية حاسوبية)، تحفظ النتيجة في جدول MealAnalysis،
وتحفظ نسخة من الصورة في Google Drive إن وافق المستخدم.

لماذا نحتاجه؟
صفحة تحليل الوجبة ترسل صورة الوجبة (بصيغة data URI) هنا،
ليُرجع الخادم قائمة الأطعمة والسعرات والمغذيات المكتشفة.

متى يعمل؟
عند استقبال طلب POST إلى /api/analyze-meal.
(المسار في الملفات هو من "تسمية الـ API" — لا نكتب get/post في الرابط)

ترتيب التنفيذ (قصة الطلب):
1. من المستخدم؟ لو غير مسجل → 401.
2. هل أرسل طلبات كثيرة؟ (rateLimit) → 429.
3. نقرأ صورة الوجبة من نص الطلب.
4. لو الصورة غير صالحة أو أكبر من 3MB → 422.
5. بموافقة المستخدم: نحفظ الصورة محليًا + سجل في جدول Photo.
6. نمرر الصورة لموفر الرؤية (getVisionProvider) للتحليل.
7. نحفظ التحليل في جدول MealAnalysis.
8. نسجل العملية (audit) ونرجع النتيجة + إخلاء المسؤولية.

ماذا يعني HTTP Status؟
- 200: نجاح. 400: بيانات غير صالحة.
- 401: غير مسجل. 422: صورة غير صالحة/كبيرة.
- 429: طلبات كثيرة. 500: فشل في التحليل.

العلاقة مع الملفات:
- getCurrentUser من lib/auth.
- prisma من lib/prisma.
- getVisionProvider + ANALYZE_DISCLAIMER من services/ai.
- rateLimit + audit من lib/security.
- syncToGoogleDrive من lib/google-sync.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع طلبات
// الخادم (قراءة الطلب + إرسال الرد). من مكتبة next/server.
import { NextRequest, NextResponse } from 'next/server';
// writeFile/mkdir: من مكتبة fs/promises (أدوات النظام في Node.js)
// — لحفظ صورة الوجبة على القرص داخل مجلد الملفات العامة.
import { writeFile, mkdir } from 'fs/promises';
// path: من مكتبة path — لبناء مسار المجلد الذي سنحفظ فيه الصور.
import path from 'path';
// crypto: من مكتبة crypto — لإنشاء معرّف فريد (UUID) لاسم صورة الوجبة.
import crypto from 'crypto';
// getCurrentUser: ملف محلي من lib/auth — يتحقق من تسجيل الدخول
// ويعيد بيانات المستخدم الحالي (أو null لو غير مسجل).
import { getCurrentUser } from '@/lib/auth';
// prisma: ملف محلي من lib/prisma — أداة قراءة/كتابة قاعدة البيانات.
import { prisma } from '@/lib/prisma';
// getVisionProvider + ANALYZE_DISCLAIMER: من services/ai —
// موفّر تحليل الصور بالذكاء الاصطناعي + نص إخلاء المسؤولية الطبية.
import { getVisionProvider, ANALYZE_DISCLAIMER } from '@/services/ai';
// rateLimit + audit: من lib/security — منع الطلبات الكثيرة + تسجيل العملية.
import { rateLimit, audit } from '@/lib/security';
// syncToGoogleDrive: من lib/google-sync — رفع نسخة من الصورة والتحليل
// إلى Google Drive للتوثيق (اختياري ولا يمنع التحليل لو فشل).
import { syncToGoogleDrive } from '@/lib/google-sync';

// ========================================
// 2. الثوابت
// ========================================

// أقصى حجم مسموح للصورة = 3 ميجابايت (3 × 1024 × 1024 بايت).
// اخترناه أصغر من حد جسم طلبات Vercel (~4.5MB) بعد ترميز base64
// حتى لا يرفض الخادم الطلب بسبب الحجم.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB — أقل من حد جسم طلبات Vercel (~4.5MB) بعد ترميز base64

// ========================================
// 3. معالج الطلب POST
// ========================================

// export async function POST:
// اسم الدالة = نوع الطلب. Next.js يستدعي POST تلقائيًا
// عند وصول طلب POST إلى /api/analyze-meal.
// req: كائن الطلب الواصل (يحوي الصورة وبيانات الموافقة).
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  // لو غير مسجل → نرجع 401 مع رسالة JSON.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  }

  // الخطوة 2: منع إرسال أكثر من 20 طلبًا في الدقيقة لنفس المستخدم.
  // x-forwarded-for: عنوان IP القادم من بروكسي (معلومات إضافية).
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`analyze:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  // الخطوة 3: قراءة جسم الطلب (JSON).
  // await req.json(): تحويل نص الطلب إلى كائن JavaScript.
  // body.image: الصورة على صيغة data URI. body.consent: موافقة المستخدم على الحفظ.
  let body: { image?: string; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    // لو النص الواصل ليس JSON صالحًا → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: التحقق من شكل الصورة.
  // startsWith('data:image/'): هل الصورة تبدأ بالصيغة الصحيحة؟ لو لا → 422.
  if (!body.image || !body.image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'صورة غير صالحة' }, { status: 422 });
  }

  // split(',')[1]: الجزء بعد الفاصلة = البيانات المشفرة base64.
  // Buffer.from(base64, 'base64'): فك الترميز إلى بايتات فعلية.
  const base64 = body.image.split(',')[1];
  const imageBytes = Buffer.from(base64, 'base64');
  // لو حجم الصورة يتجاوز 3 ميجابايت → 422 مع رسالة إرشادية للمستخدم.
  if (imageBytes.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'حجم الصورة يتجاوز 3 ميجابايت — التقط صورة أقرب وأخفض جودة' },
      { status: 422 }
    );
  }

  // consent: موافقة المستخدم على حفظ صورة وجبته.
  // !== false يعني "نعم" ما لم يُرسل المستخدم false صراحةً.
  const consent = body.consent !== false;

  // متغيران لسجل الصورة: معرّفها في قاعدة البيانات ورابطها (إن وافق المستخدم).
  let photoId: string | null = null;
  let photoUrl: string | null = null;

  // الخطوة 5: إن وافق المستخدم — احفظ الصورة محليًا + سجلًا في جدول Photo.
  if (consent) {
    try {
      // randomUUID: معرّف فريد عالميًا ليكون اسم الملف.
      const id = crypto.randomUUID();
      // مسار مجلد صور الوجبات: public/uploads/meals/<معرّف المستخدم>.
      const dir = path.join(process.cwd(), 'public', 'uploads', 'meals', user.id);
      // mkdir بـ recursive:true: إنشاء المجلدات الناقصة تلقائيًا دون خطأ.
      await mkdir(dir, { recursive: true });
      // امتداد الملف: png إن كانت الصورة png، وإلا jpg.
      const ext = body.image.includes('image/png') ? 'png' : 'jpg';
      const filename = `${id}.${ext}`;
      // كتابة البايتات على القرص.
      await writeFile(path.join(dir, filename), imageBytes);

      // STORAGE_BASE_URL: عنوان أساسي اختياري لملفات التخزين من إعدادات البيئة.
      const storageBase = process.env.STORAGE_BASE_URL ?? '';
      // الرابط الكامل للصورة كما ستصل إلى المتصفح.
      photoUrl = `${storageBase}/uploads/meals/${user.id}/${filename}`;
      // autoDeleteAt: تاريخ الحذف التلقائي بعد 7 أيام من الرفع.
      const autoDeleteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 أيام
      // حفظ سجل الصورة في جدول Photo ليتتبعها النظام.
      const photo = await prisma.photo.create({
        data: {
          userId: user.id,
          url: photoUrl,
          storageKey: `meals/${user.id}/${filename}`,
          analysisConsent: true,
          autoDeleteAt,
        },
      });
      photoId = photo.id;
    } catch (e) {
      // عدم توفير التخزين لا يمنع التحليل
    }
  }

  // الخطوة 6: التحليل الفعلي بالذكاء الاصطناعي.
  try {
    // getVisionProvider(): اختيار موفّر الرؤية المناسب (مثل Qwen-VL).
    const provider = getVisionProvider();
    // analyze(body.image): تحليل الصورة وإرجاع الأطعمة والسعرات والمغذيات.
    const result = await provider.analyze(body.image);

    // حفظ نتيجة التحليل في جدول MealAnalysis.
    // بعض النتائج كائنات (foods/rawResponse) نخزنها كنص JSON لأن العمود نصي.
    const analysis = await prisma.mealAnalysis.create({
      data: {
        userId: user.id,
        photoId,
        provider: result.provider,
        rawResponse: result.raw ? JSON.stringify(result.raw) : null,
        foods: result.foods ? JSON.stringify(result.foods) : null,
        totalCalories: result.totalCalories,
        totalProteinG: result.totalProteinG,
        totalCarbsG: result.totalCarbsG,
        totalFatG: result.totalFatG,
        totalFiberG: result.totalFiberG,
        totalSodiumMg: result.totalSodiumMg,
        confidence: result.confidence,
        isEstimate: true,
        needsReview: result.needsReview ?? true,
        notes: result.notes,
      },
    });

    // الخطوة 7: تسجيل العملية في سجل التدقيق (من فعل ماذا ومتى).
    // photoSaved: هل حُفظت الصورة أم لا (معلومة مفيدة للمراجعة).
    await audit(user.id, 'meal.analyze', 'MealAnalysis', analysis.id, {
      provider: result.provider,
      photoSaved: !!photoId,
    });

    // إن وافق المستخدم — نرفع نسخة من التحليل والصورة إلى Google Drive.
    if (consent) {
      // تحديد نوع الملف (MIME) حسب صيغة الصورة الأصلية.
      const mime = body.image.includes('image/png') ? 'image/png' : 'image/jpeg';
      syncToGoogleDrive({
        type: 'meal-analysis',
        data: {
          name: user.name,
          email: user.email,
          swimmerName: user.name,
          analysisId: analysis.id,
          provider: result.provider,
          confidence: result.confidence,
          totalCalories: result.totalCalories,
          totalProteinG: result.totalProteinG,
          totalCarbsG: result.totalCarbsG,
          totalFatG: result.totalFatG,
          totalFiberG: result.totalFiberG,
          totalSodiumMg: result.totalSodiumMg,
          foods: result.foods ? JSON.stringify(result.foods) : null,
          notes: result.notes,
        },
        photos: [
          {
            fileName: `${user.id}-${analysis.id}.${mime === 'image/png' ? 'png' : 'jpg'}`,
            mimeType: mime,
            base64,
            folder: 'meals',
          },
        ],
      }).catch(() => {}); // أي خطأ في درايف يُتجاهل حتى لا يكسر التحليل
    }

    // الخطوة 8: إرسال النتيجة JSON للواجهة.
    // disclaimer: نص إخلاء المسؤولية الذي يجب عرضه مع النتيجة.
    return NextResponse.json({
      ok: true,
      analysisId: analysis.id,
      result,
      disclaimer: ANALYZE_DISCLAIMER,
    });
  } catch (err) {
    // أي خطأ أثناء التحليل أو الحفظ → 500 مع رسالة الخطأ.
    const msg = err instanceof Error ? err.message : 'تعذر تحليل الصورة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
