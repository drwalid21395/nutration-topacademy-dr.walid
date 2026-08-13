import crypto from 'crypto';

/** اشتقاق مفتاح تشفير من سرّ البيئة (لا يُخزَّن المفتاح نفسه في قاعدة البيانات). */
function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET ?? 'top-academy-dev-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/** تشفير نص حساس (مثل توكنات OAuth) بتقنية AES-256-GCM. */
export function encryptText(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

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
