/** أدوات أمان عامة: تحديد معدل الطلبات، التعقيم، تسجيل العمليات الحساسة */

const RATE_LIMITS = new Map<string, { count: number; resetAt: number }>();

/**
 * تحديد معدل الطلبات البسيط في الذاكرة (للاستخدام في API Routes)
 * يُفضّل استبداله بـ Upstash/Redis في بيئة الإنتاج الموزعة.
 */
export function rateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = RATE_LIMITS.get(key);
  if (!entry || entry.resetAt < now) {
    RATE_LIMITS.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/** تعقيم نص من HTML الخبيث */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, 5000);
}

import { prisma } from '@/lib/prisma';

/** تسجيل عملية في سجل التدقيق (لا تسجل بيانات حساسة) */
export async function audit(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  } catch {
    // لا نريد كسر سير العمل عند فشل التسجيل
  }
}

/** هل النص يحتوي HTML/JS مشبوه؟ */
export function containsMarkup(input: string): boolean {
  return /<[a-zA-Z/!]|javascript:|on\w+\s*=|<\s*(script|iframe|object|embed)/i.test(input);
}
