/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/sync/route.ts

وظيفة الملف:
واجهة API بحرف POST تقوم بمزامنة اتصال واحد بساعة/مزود:
تفك تشفير التوكن، تسحب بيانات المزود (نشاط/تدريبات/نوم/وزن)،
تطبيعها، تزيل التكرار، تحفظها في القاعدة، ثم تعيد حساب
احتياجات اليوم الغذائية.

لماذا نحتاجه؟
هذه هي «اللحظة الحقيقية» التي تنتقل فيها بيانات الساعة
من المزود إلى قاعدتنا، ليُبنى عليها التقييم الغذائي.

متى يعمل؟
عند استقبال طلب POST إلى /api/wearables/sync
(بالضغط على زر «مزامنة الآن» في صفحة الساعات).

من يستدعي هذا الملف؟
صفحة «ربط الساعات الذكية» — زر المزامنة اليدوية.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth.
- rateLimit + audit من lib/security.
- prisma من lib/prisma: جداول WearableConnection و SyncLog
  وما يُكتب من نشاط وتدريبات.
- decryptText من lib/crypto (فك تشفير التوكن).
- getAdapter من lib/wearables/adapters (جلب البيانات من المزود).
- ingestProviderData + logSync من lib/wearables/sync.
- recalculateToday من lib/nutrition/dynamic.

ترتيب العمل:
1. غير مسجل → 401. طلبات كثيرة → 429.
2. نقرأ معرّف الاتصال → 400 لو غير صالح.
3. لا يوجد اتصال مفعّل → 404.
4. اليدوي: نحدّث وقت المزامنة ونعيد حساب اليوم → نجاح فوري.
5. نفك تشفير التوكن → لا يوجد → رسالة «أعد الربط» → 400.
6. نسحب البيانات من المزود عبر المُكيّف.
7. نمرر البيانات عبر ingestProviderData (تطبيع + حفظ).
8. نحدّث وقت المزامنة ونفتش ونعد حساب اليوم.
9. نرجع ملخص ما تمت مزامنته.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// getCurrentUser: دالة محلية من lib/auth تعيد المستخدم الحالي.
import { getCurrentUser } from '@/lib/auth';
// prisma: عميل قاعدة البيانات (محلي) — نقرأ ونكتب بالجداول.
import { prisma } from '@/lib/prisma';
// rateLimit: يمنع الإفراط. audit: يسجل العمليات. من lib/security.
import { rateLimit, audit } from '@/lib/security';
// decryptText: دالة محلية من lib/crypto تفك تشفير التوكن
// (لأننا نخزّنه مشفرًا ولا نستطيع قراءته إلا بفك التشفير).
import { decryptText } from '@/lib/crypto';
// getAdapter: دالة محلية من lib/wearables/adapters تعيد
// مُكيّف المزود القادر على سحب البيانات الفعلية منه.
import { getAdapter } from '@/lib/wearables/adapters';
// ingestProviderData: تحويل بيانات المزود الخام إلى جداولنا.
// logSync: حفظ سجل المزامنة. كلاهما من lib/wearables/sync.
import { ingestProviderData, logSync } from '@/lib/wearables/sync';
// recalculateToday: دالة محلية من lib/nutrition/dynamic
// تعيد حساب الأهداف الغذائية بعد وصول بيانات جديدة.
import { recalculateToday } from '@/lib/nutrition/dynamic';

// ========================================
// 2. معالج المزامنة (POST)
// ========================================

/**
 * مزامنة اتصال مزود.
 * بدون توكن فعّال (أو مزود غير مكوَّن) نعيد حالة واضحة دون بيانات وهمية.
 */
// POST: مزامنة اتصال واحد. نؤكد دائمًا أن الاتصال للمستخدم نفسه.
export async function POST(req: NextRequest) {
  // الخطوة 1: تحقق من تسجيل الدخول.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // الخطوة 2: منع أكثر من 10 مزامنات في الدقيقة.
  // 429: طلبات كثيرة.
  if (!rateLimit(`sync:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  // الخطوة 3: قراءة معرّف الاتصال من جسم الطلب.
  let body: { connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  // الخطوة 4: البحث عن الاتصال — بشرط أنه للمستخدم نفسه
  // وحالته connected. لو لا يوجد → 404.
  const conn = await prisma.wearableConnection.findFirst({
    where: { id: String(body.connectionId ?? ''), userId: user.id, status: 'connected' },
  });
  if (!conn) return NextResponse.json({ error: 'لا يوجد اتصال مفعّل بهذا المزود' }, { status: 404 });

  // بداية قياس مدة المزامنة (تُحفظ في سجل المزامنة).
  const started = Date.now();

  // الخطوة 5: الاتصال اليدوي — لا ساعة فعلية، فقط نحدّث الوقت
  // ونعيد حساب اليوم، فالإدخال اليدوي «متاح دائمًا».
  if (conn.provider === 'manual') {
    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
    await logSync(user.id, 'manual', 'success', 0, 'الإدخال اليدوي متاح دائمًا.', Date.now() - started);
    await recalculateToday(user.id);
    return NextResponse.json({ ok: true, message: 'جاهز. سجّل نشاطك أو تدريباتك يدويًا.' });
  }

  // الخطوة 6: فك تشفير التوكن المخزّن.
  // لو التوكن غير صالح (فارغ/فاسد) → نخبره بإعادة الربط → 400.
  const token = decryptText(conn.accessToken);
  if (!token) {
    await prisma.wearableConnection.update({
      where: { id: conn.id },
      data: { lastSyncError: 'لا يوجد توكن صالح — أعد الربط.', lastSyncAt: new Date() },
    });
    await logSync(user.id, conn.provider, 'error', 0, 'لا يوجد توكن صالح.', Date.now() - started);
    return NextResponse.json({ error: 'لا يوجد توكن صالح — أعد الربط.' }, { status: 400 });
  }

  // الخطوة 7: سحب البيانات من المزود عبر المُكيّف.
  // adapter.sync يتصل بخدمة المزود بالتوكن ويعيد نشاطًا وتدريبات...
  const adapter = getAdapter(conn.provider);
  const data = await adapter.sync(user.id, token);

  // الخطوة 8: تمرير البيانات عبر خط التطبيع الموحّد:
  // نشاط → تدريبات → نوم → وزن → إعادة حساب.
  // ingestProviderData يحوّل الصيغ المختلفة إلى جداولنا القياسية.
  const ingested = await ingestProviderData(user.id, data, conn.provider);

  // الخطوة 9: تحديث وقت آخر مزامنة ومسح أي خطأ سابق.
  await prisma.wearableConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });
  // الخطوة 10: تسجيل العملية في سجل التدقيق مع عدد التدريبات المستوردة.
  await audit(user.id, 'wearable.sync', 'WearableConnection', conn.id, {
    provider: conn.provider,
    items: data.workouts?.length ?? 0,
    ingested: ingested.workoutsUpserted,
  });
  // الخطوة 11: حفظ سجل المزامنة الناجحة.
  await logSync(user.id, conn.provider, 'success', ingested.workoutsUpserted, ingested.message, Date.now() - started);
  // الخطوة 12: إعادة حساب احتياجات اليوم بعد تحديث النشاط.
  await recalculateToday(user.id);
  // الخطوة 13: إرجاع الملخص للواجهة.
  return NextResponse.json({ ok: true, message: ingested.message, ingested });
}
