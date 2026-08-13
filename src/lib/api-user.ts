import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-token';
import { getCurrentUser, SessionUser } from '@/lib/auth';

/**
 * تحديد المستخدم الحالي من طلب API:
 * 1) إن وُجد توكن موبايل (Authorization: Bearer …) → نستخدمه.
 * 2) وإلا نستخدم جلسة الويب (كوكي NextAuth).
 * هذا يسمح لتطبيق الموبايل (الجسر) بإرسال بيانات الساعة بنفس نقاط الاستقبال.
 */
export async function getApiUser(req: NextRequest): Promise<SessionUser | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;
  const payload = verifyMobileToken(token);

  if (payload) {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!user || user.status !== 'active') return null;
    return { id: user.id, name: user.name, email: user.email, image: null, role: user.role };
  }

  return getCurrentUser();
}
