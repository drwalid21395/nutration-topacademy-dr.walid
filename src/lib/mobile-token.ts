import crypto from 'crypto';

/**
 * توكن الموبايل — JWT بسيط (HS256) موقّع بنفس سرّ الجلسات (NEXTAUTH_SECRET).
 * يُستخدم في تطبيق الموبايل (الجسر) بدل كوكي الجلسة الذي لا يناسب التطبيقات.
 * لا يُخزَّن أي شيء إضافي في قاعدة البيانات — توقيع فقط.
 */

const MAX_AGE_SEC = 90 * 24 * 3600; // 90 يومًا
const TOKEN_TTL_MS = MAX_AGE_SEC * 1000;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.APP_ENCRYPTION_KEY ?? 'top-academy-dev-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export interface MobileTokenPayload {
  sub: string; // userId
  role: string;
  iat: number;
  exp: number;
}

/** توقيع توكن موبايل لمستخدم. */
export function signMobileToken(userId: string, role = 'athlete'): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Date.now();
  const payload = b64url(
    JSON.stringify({ sub: userId, role, iat: Math.floor(now / 1000), exp: Math.floor((now + TOKEN_TTL_MS) / 1000) })
  );
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', getKey()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** التحقق من توكن موبايل وإرجاع الحمولة، أو null عند عدم الصلاحية. */
export function verifyMobileToken(token: string | null | undefined): MobileTokenPayload | null {
  if (!token) return null;
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;
    const data = `${header}.${payload}`;
    const expected = crypto.createHmac('sha256', getKey()).update(data).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MobileTokenPayload;
    if (!parsed?.sub || typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
