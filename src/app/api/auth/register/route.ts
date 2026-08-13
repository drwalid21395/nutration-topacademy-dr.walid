/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/auth/register/route.ts

وظيفة الملف:
واجهة API (POST) تنشئ حسابًا جديدًا في النظام.
تستقبل بيانات النموذج، تتحقق منها، تشفر كلمة المرور،
تحفظ المستخدم في قاعدة البيانات، وتسجل العملية.

لماذا نحتاجه؟
صفحة التسجيل (src/app/register/page.tsx) ترسل هنا البيانات
بدل حفظها مباشرة — لأن التشفير والتحقق يجب أن يعملا في الخادم
وليس في المتصفح (المتصفح مكان مكشوف).

متى يعمل؟
عند طلب POST إلى /api/auth/register.

ترتيب التنفيذ (قصة الطلب):
1. rateLimit: منع محاولات كثيرة من نفس العنوان (IP).
2. قراءة الجسم (JSON) وفك ترميزه.
3. zod: التحقق من البيانات (registerSchema).
4. ننظف البريد (أحرف صغيرة) ونفحص إن كان مسجلًا من قبل (409).
5. نمنع إنشاء حساب بمنصب مدير (أمان): أي role=admin → athlete.
6. تشفير كلمة المرور (bcrypt.hash، 12 جولة).
7. prisma.user.create: حفظ المستخدم.
8. audit: تسجيل عملية إنشاء الحساب.
9. نرجع 201 (نجاح) مع بيانات المستخدم.

ما معنى أكواد الحالة؟
- 429: محاولات كثيرة. 400: JSON غير صالح.
- 422: بيانات غير صالحة. 409: البريد موجود مسبقًا. 201: تم الإنشاء.

العلاقة مع الملفات:
- registerSchema من lib/validation.
- bcrypt من مكتبة bcryptjs.
- rateLimit/sanitizeText/audit من lib/security.
- prisma من lib/prisma.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { NextRequest, NextResponse } from 'next/server';
// bcrypt: مكتبة تشفير كلمات المرور (هاش). يعمل في الخادم فقط.
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
// registerSchema: مخطط التحقق من بيانات التسجيل.
import { registerSchema } from '@/lib/validation';
// أدوات الأمان: تقييد الطلبات + التسجيل + تنظيف النص.
import { rateLimit, audit, sanitizeText } from '@/lib/security';

// ========================================
// 2. معالج الطلب
// ========================================

// POST: الاسم يطابق نوع الطلب → يستدعى تلقائيًا.
export async function POST(req: NextRequest) {
  // الخطوة 1: الحد من المحاولات المتكررة من نفس IP.
  // 10 محاولات كحد أقصى خلال 15 دقيقة.
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`register:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  // الخطوة 2: قراءة نص الطلب وتحويله من JSON.
  // body: unknown → نستخدم نوعًا عامًا حتى نتحقق منه لاحقًا.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // لو النص ليس JSON صحيح → 400.
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 3: التحقق من البيانات عبر zod.
  // safeParse: لا يرمي خطأ — يرجع نتيجة تحتوي success + data/error.
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    // نأخذ رسالة أول خطأ ونعيدها للمستخدم.
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' },
      { status: 422 }
    );
  }

  // هنا البيانات مؤكدة صحيحة حسب المخطط.
  const data = parsed.data;
  // ننظف البريد: أحرف صغيرة (لكي لا يتكرر نفس البريد بصيغ مختلفة).
  const email = data.email.toLowerCase();

  // الخطوة 4: هل البريد مسجل مسبقًا؟
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    // 409 = تعارض (conflict) — المورد موجود بالفعل.
    return NextResponse.json(
      { error: 'هذا البريد مسجّل بالفعل، يمكنك تسجيل الدخول' },
      { status: 409 }
    );
  }

  // الخطوة 5: الأمان — منع إنشاء حساب مدير من التسجيل المفتوح.
  // لو أحد أرسل role: 'admin' نجعله athlete (لا نرفض الطلب بل نخفض الصلاحية).
  const role = data.role === 'admin' ? 'athlete' : data.role;

  // الخطوة 6: تشفير كلمة المرور.
  // bcrypt.hash(النص, 12): عدد الجولات 12 = توازن بين الأمان والسرعة.
  // لا نخزن كلمة المرور نفسها أبدًا — فقط هذا الهاش.
  const passwordHash = await bcrypt.hash(data.password, 12);

  // isMinor: هل المستخدم قاصر؟ (نعكس إجابة "بالغ").
  const isMinor = data.isAdult === false;

  // الخطوة 7: حفظ المستخدم في قاعدة البيانات.
  // sanitizeText: تنظيف النصوص من HTML الخبيث قبل الحفظ.
  // select: نطلب من Prisma إرجاع حقول محددة فقط (لا الهاش).
  const user = await prisma.user.create({
    data: {
      name: sanitizeText(data.name),
      email,
      phone: sanitizeText(data.phone ?? ''),
      passwordHash,
      role,
      isAdult: data.isAdult,
      parentalConsent: isMinor, // موافقة ولي الأمر (إلزامية للقاصر)
      parentName: sanitizeText(data.parentName ?? ''),
      parentPhone: sanitizeText(data.parentPhone ?? ''),
      acceptTerms: data.acceptTerms,
      acceptPrivacy: data.acceptPrivacy,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // الخطوة 8: تسجيل العملية في سجل التدقيق.
  await audit(user.id, 'auth.register', 'User', user.id, { role: user.role });

  // الخطوة 9: الرد 201 (Created) — تم إنشاء المورد بنجاح.
  return NextResponse.json(
    { ok: true, message: 'تم إنشاء الحساب بنجاح', user },
    { status: 201 }
  );
}
