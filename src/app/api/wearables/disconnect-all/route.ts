/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/disconnect-all/route.ts

وظيفة الملف:
واجهة API بحرف POST تفصل جميع اتصالات شركات الساعات القديمة
(Fitbit/Garmin/Polar/...) عن حساب المستخدم دفعة واحدة، لأن
تطبيق الموبايل (Health Connect) أصبح البديل الوحيد — ويُبقي
اتصالي «mobile» و«manual».

لماذا نحتاجه؟
السباح يريد مسح كل شركات الساعات القديمة من صفحة ربط الساعة
دفعة واحدة بدل حذف كل واحدة على حدة.

متى يعمل؟
عند الضغط على زر «مسح جميع شركات الساعات القديمة» في صفحة ربط الساعة.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- prisma من lib/prisma: جدول WearableConnection.
- audit من lib/security.

ترتيب العمل:
1. غير مسجل → 401.
2. نعطّل كل الاتصالات ماعدا mobile وmanual.
3. نسجل العملية ونرجع عدد الممسوح.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/security';

// ========================================
// 2. معالج المسح الشامل (POST)
// ========================================

/** مسح كل اتصالات شركات الساعات القديمة — لمالك الحساب فقط. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const result = await prisma.wearableConnection.updateMany({
    where: { userId: user.id, provider: { notIn: ['mobile', 'manual'] } },
    data: { status: 'disconnected', accessToken: null, refreshToken: null, lastSyncAt: null },
  });

  await audit(user.id, 'wearable.disconnect-all', 'WearableConnection', undefined, { deleted: result.count });
  return NextResponse.json({ ok: true, deleted: result.count });
}
