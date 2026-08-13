/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/lib/api-user.ts

وظيفة الملف:
تحديد "من يرسل هذا الطلب" داخل واجهات API، بطريقتين:
1) إن وُجد توكن موبايل (Authorization: Bearer …) → نستخدمه.
2) وإلا نستخدم جلسة الويب (كوكي NextAuth).

لماذا نحتاجه؟
موقعنا له "جسر موبايل" (تطبيق Flutter) يرسل بيانات إلى نفس
واجهات API. تطبيق الموبايل لا يملك كوكي، لذا نحتاج فحصًا
مرنًا: "إما كوكي ويب أو توكن موبايل".

متى تعمل؟
مع كل طلب يصل لواجهة API تستخدم getApiUser.

من يستدعيها؟
واجهات استقبال البيانات الصحية (wearables، health logs...).
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-token';
import { getCurrentUser, SessionUser } from '@/lib/auth';

/*
-----------------------------------------
الدالة: getApiUser
-----------------------------------------
Input: req (كائن الطلب الواصل).
Output: SessionUser أو null.

ترتيب التنفيذ:
1. نقرأ ترويسة Authorization.
2. نفحص إن كانت بصيغة "Bearer <token>".
3. لو وجد توكن → نتحقق منه (verifyMobileToken).
4. لو صالح → نجلب المستخدم من قاعدة البيانات ونعيده.
5. لو لا يوجد توكن صالح → نعتمد على جلسة الويب (getCurrentUser).
-----------------------------------------
*/
/**
 * تحديد المستخدم الحالي من طلب API:
 * 1) إن وُجد توكن موبايل (Authorization: Bearer …) → نستخدمه.
 * 2) وإلا نستخدم جلسة الويب (كوكي NextAuth).
 * هذا يسمح لتطبيق الموبايل (الجسر) بإرسال بيانات الساعة بنفس نقاط الاستقبال.
 */
export async function getApiUser(req: NextRequest): Promise<SessionUser | null> {
  // نقرأ ترويسة Authorization (قد تكون فارغة).
  const authHeader = req.headers.get('authorization') ?? '';
  // match: هل النص بصيغة "Bearer كلمة"؟ (regex)
  // ^ = بداية النص، ( +) = فراغ وحرف واحد على الأقل، $ = النهاية.
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;
  // نتحقق من صحة التوكن وتوقيعه.
  const payload = verifyMobileToken(token);

  // لو التوكن صالح:
  if (payload) {
    // نجلب المستخدم من قاعدة البيانات بالمعرف الموجود في التوكن (payload.sub).
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    // لو غير موجود أو الحساب معطل → نرفض.
    if (!user || user.status !== 'active') return null;
    // نعيد بياناته (دون صورة لتقليل الحجم).
    return { id: user.id, name: user.name, email: user.email, image: null, role: user.role };
  }

  // لو لا يوجد توكن موبايل → نستخدم جلسة الويب.
  return getCurrentUser();
}
