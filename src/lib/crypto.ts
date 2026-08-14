/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/crypto.ts

وظيفة الملف:
تشفير النصوص الحساسة (مثل توكنات OAuth الخاصة بالساعات
الذكية) وفك تشفيرها. نحن لا نريد تخزين التوكنات "كما هي"
في قاعدة البيانات — لو تسرّبت القاعدة لبقيت التوكنات سرية.

لماذا نحتاجه؟
توكن الوصول للساعة (Fitbit/Strava/...) هو "مفتاح" يدخل
لحساب المستخدم الرياضي. يجب ألا نتركه نصًا مفتوحًا في الجدول.

متى يعمل؟
عند حفظ التوكن لأول مرة (تشفير) وعند استعماله في المزامنة (فك تشفير).

من يستدعيه؟
- src/lib/wearables/sync.ts (فك التشفير قبل المزامنة).
- ملفات الجالبين (fitbit.ts، strava.ts، oura.ts، polar.ts)
  عبر دوال refresh (تشفير التوكن الجديد).

الملفات التي يتعامل معها:
- لا يتعامل مع ملفات أخرى سوى مكتبة crypto المدمجة في Node.js
  (خارجية — موجودة في اللغة نفسها وليست بحاجة إلى تثبيت).

ترتيب العمل:
getKey ← encryptText / decryptText (حسب الطلب)
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// crypto: مكتبة Node.js المدمجة للتشفير والتجزئة (Hashing).
// ليست من JavaScript نفسها ولا من node_modules — توجد في بيئة الخادم.
import crypto from 'crypto';

// ========================================
// 2. المفتاح ودالتا التشفير
// ========================================

/*
-----------------------------------------
الدالة: getKey (داخلية — غير مصدَّرة)
-----------------------------------------
وظيفتها: إنتاج "مفتاح تشفير" ثابت من سرّ موجود في البيئة.
Input: لا مدخلات — تقرأ متغيرات البيئة مباشرة.
Processing: تأخذ سر التشفير (APP_ENCRYPTION_KEY أو
            NEXTAUTH_SECRET أو قيمة افتراضية للتطوير) ثم تحوله
            عبر SHA-256 إلى مفتاح بطول ثابت (32 بايت).
Output: Buffer (المفتاح).
ملاحظة تعليمية:
يمكن كتابة هذا الجزء بطريقة أخرى أكثر احترافية (بمكتبة مثل
keygrip أو تخزين مفتاح منفصل)، لكننا سنتركه حاليًا كما هو
حتى لا نغير سلوك المشروع.
-----------------------------------------
*/
/** اشتقاق مفتاح تشفير من سرّ البيئة (لا يُخزَّن المفتاح نفسه في قاعدة البيانات). */
function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET ?? 'top-academy-dev-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/*
-----------------------------------------
الدالة: encryptText (مصدَّرة)
-----------------------------------------
وظيفتها: تشفير نص حساس (مثل توكن OAuth) قبل تخزينه في القاعدة.
Input: plain (النص الأصلي).
Processing: توليد "IV" عشوائي (قيمة أولية)، تشفير النص بخوارزمية
            AES-256-GCM، ثم إضافة "Auth Tag" (ختم يضمن عدم العبث).
Output: سلسلة واحدة تتكون من ثلاث قطع Base64 مفصولة بنقاط:
        IV.tag.النص المشفر — تُحفظ كلها معًا في القاعدة.
يستدعيها: ملفات الجالبين عند حفظ توكن جديد (fitbit.ts وغيرها).
ماذا تستدعي: getKey + مكتبة crypto.
-----------------------------------------
*/
/** تشفير نص حساس (مثل توكنات OAuth) بتقنية AES-256-GCM. */
export function encryptText(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

/*
-----------------------------------------
الدالة: decryptText (مصدَّرة)
-----------------------------------------
وظيفتها: استرجاع النص الأصلي من النص المشفر.
Input: payload (النص المشفر، قد يكون null/undefined).
Processing: نقسم النص على النقاط إلى IV + Tag + البيانات،
            ثم نعيد فك التشفير.
Output: النص الأصلي، أو null عند فشل الفك (بيانات تالفة
        أو مفقودة) — لا نرمي خطأ حتى لا نكسر سير العمل.
يستدعيها: sync.ts و refreshIfNeeded في ملفات الجالبين.
ماذا تستدعي: getKey + مكتبة crypto.
-----------------------------------------
*/
/** فك تشفير نص مشفّر سابقًا. */
export function decryptText(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
