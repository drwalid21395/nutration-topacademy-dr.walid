/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/lib/mobile-token.ts

وظيفة الملف:
توليد "توكن" (رمز أمان) لتطبيق الموبايل والتحقق منه.
التوكن = JWT بسيط (HS256) موقّع بنفس سر الجلسات.

لماذا نحتاجه؟
موقع الويب يستخدم "كوكي" (Cookie) لحفظ الجلسة، لكن تطبيق
الموبايل (جسر Flutter) لا يتعامل مع الكوكيز. الحل: يعطي
تطبيق الموبايل توكنًا نصيًا يحمله مع كل طلب في ترويسة
Authorization: Bearer <token>.

ماذا يوجد داخل التوكن؟
3 أجزاء مفصولة بنقاط:
الجزء1.الجزء2.الجزء3
header | payload (بيانات مثل userId) | signature (التوقيع)
- الـ signature هو "ختم" نصنعه بسر سري — لو غيّر أحد البيانات
  يكسر الختم فنرفضه. (عبر crypto.timingSafeEqual)

من يستخدمه؟
- src/lib/api-user.ts: يفحص التوكن القادم من الموبايل.
- src/app/api/mobile/login/route.ts: يصنع التوكن بعد الدخول.
==================================================
*/

// ========================================
// 1. المكتبة والأسرار
// ========================================

// crypto: مكتبة داخلية في Node.js (ليست من متصفح JavaScript).
// توفر عمليات التشفير والتوقيع.
import crypto from 'crypto';

// MAX_AGE_SEC: مدة صلاحية التوكن (90 يومًا).
const MAX_AGE_SEC = 90 * 24 * 3600; // 90 يومًا
const TOKEN_TTL_MS = MAX_AGE_SEC * 1000;

// ========================================
// 2. دوال مساعدة
// ========================================

// b64url: تحويل نص إلى ترميز Base64URL (ترميز آمن للروابط).
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

// getKey: نصنع "مفتاح التوقيع" من السر (NEXTAUTH_SECRET).
// createHash('sha256')...digest(): يحول السر إلى مفتاح ثابت الطول.
// حتى لو تغير السر لأي سبب، استرجاع المفتاح يكون دائمًا بنفس الطريقة.
function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.APP_ENCRYPTION_KEY ?? 'top-academy-dev-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

// ========================================
// 3. نوع بيانات التوكن
// ========================================

export interface MobileTokenPayload {
  sub: string; // userId: صاحب التوكن
  role: string; // دور المستخدم (سباح، مدرب...)
  iat: number; // تاريخ الإصدار (بالثواني)
  exp: number; // تاريخ الانتهاء (بالثواني)
}

// ========================================
// 4. توقيع التوكن
// ========================================

/*
-----------------------------------------
الدالة: signMobileToken
-----------------------------------------
وظيفتها: إنشاء توكن موبايل لمستخدم.
Input: userId + role.
Output: نص التوكن الكامل (header.payload.signature).
يتم استدعاؤها من: src/app/api/mobile/login/route.ts
-----------------------------------------
*/
/** توقيع توكن موبايل لمستخدم. */
export function signMobileToken(userId: string, role = 'athlete'): string {
  // الجزء 1: header — يحدد خوارزمية التوقيع (HS256) ونوعه (JWT).
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Date.now();
  // الجزء 2: payload — البيانات نفسها (من هو + متى يصدر + متى ينتهي).
  const payload = b64url(
    JSON.stringify({ sub: userId, role, iat: Math.floor(now / 1000), exp: Math.floor((now + TOKEN_TTL_MS) / 1000) })
  );
  const data = `${header}.${payload}`;
  // الجزء 3: signature — HMAC (توقيع بمفتاح). أي تغيير في البيانات
  // يجعل التوقيع غير متطابق عند الفحص.
  const sig = crypto.createHmac('sha256', getKey()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// ========================================
// 5. التحقق من التوكن
// ========================================

/*
-----------------------------------------
الدالة: verifyMobileToken
-----------------------------------------
وظيفتها: فحص التوكن وإرجاع البيانات أو null لو غير صالح.
Input: التوكن. Output: MobileTokenPayload أو null.

ترتيب التنفيذ:
1. لو لا يوجد توكن → null.
2. نقسم التوكن إلى 3 أجزاء.
3. نعيد حساب التوقيع ونقارنه مع الموجود (timingSafeEqual).
4. لو التوقيع سليم → نقرأ البيانات ونتحقق أن الانتهاء لم يحن.
5. أي خطأ (catch) → null.
يتم استدعاؤها من: src/lib/api-user.ts
-----------------------------------------
*/
/** التحقق من توكن موبايل وإرجاع الحمولة، أو null عند عدم الصلاحية. */
export function verifyMobileToken(token: string | null | undefined): MobileTokenPayload | null {
  if (!token) return null;
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;
    const data = `${header}.${payload}`;
    // نعيد حساب التوقيع الذي يجب أن يكون عليه التوكن الأصلي.
    const expected = crypto.createHmac('sha256', getKey()).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    // timingSafeEqual: مقارنة آمنة الزمن — تمنع "تخمين" التوقيع
    // عن طريق قياس زمن المقارنة. (لو استخدمنا === قد يخمّن المخترق)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    // فك ترميز البيانات وقراءتها.
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MobileTokenPayload;
    // تحقق: هل يوجد userId؟ وهل لم ينتهِ التوكن (exp)؟
    if (!parsed?.sub || typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
