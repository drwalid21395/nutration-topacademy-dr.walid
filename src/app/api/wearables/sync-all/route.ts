/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/api/wearables/sync-all/route.ts

وظيفة الملف:
واجهة API بحرف POST تُشغّل «المزامنة الدورية» لكل المستخدمين
دفعة واحدة: تبحث عن كل اتصالات الساعات المستحقة للمزامنة
(مر عليها أكثر من ١٥ دقيقة) وتُحدّثها واحدًا واحدًا.

لماذا نحتاجه؟
لا يمكننا انتظار المستخدم ليضغط «مزامنة» كل مرة — البيانات
يجب أن تصل تلقائيًا. Vercel Cron يستدعي هذا المسار كل
١٥ دقيقة ليعمل بهدوء في الخلفية.

متى يعمل؟
تلقائيًا كل ١٥ دقيقة من Vercel Cron (مؤقّت في Vercel).

من يستدعي هذا الملف؟
لا يستدعيه متصفح — بل جدولة Vercel Cron، مع مفتاح CRON_SECRET
في رأس Authorization حتى لا يستطيع أي شخص تشغيله.

الملفات التي يتعامل معها:
- findDueConnections + runSyncConnection من lib/wearables/sync.

ترتيب العمل:
1. نفحص المفتاح السري في رأس Authorization → خاطئ → 401.
2. نبحث عن الاتصالات المستحقة للمزامنة.
3. لكل اتصال → ننفذ مزامنة كاملة ونجمع نتيجتها.
4. نرجع عدد المزامنات ونتائجها.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// NextRequest/NextResponse: أدوات Next.js للتعامل مع الطلبات
// والردود. من مكتبة next/server (خارجية).
import { NextRequest, NextResponse } from 'next/server';
// findDueConnections: تعيد الاتصالات المستحقة للمزامنة (المضى عليها
// أكثر من المدة). runSyncConnection: تشغيل مزامنة كاملة لاتصال واحد.
// كلاهما من lib/wearables/sync (محلي).
import { findDueConnections, runSyncConnection } from '@/lib/wearables/sync';

// ========================================
// 2. معالج المزامنة الدورية (POST)
// ========================================

/**
 * مزامنة دورية لكل المستخدمين — تُستدعى من Vercel Cron كل ١٥ دقيقة.
 * محمية بمفتاح CRON_SECRET في رأس Authorization.
 */
// POST: مهمة خلفية تجمع المزامنات المستحقة وتنفذها.
export async function POST(req: NextRequest) {
  // الخطوة 1: فحص الأمان.
  // CRON_SECRET: مفتاح سري من البيئة. لو مُعرّف، يجب أن يصل الطلب
  // برأس Authorization بقيمة Bearer + المفتاح، وإلا → 401 (غير مصرح).
  // (لو المفتاح غير مُعرّف في البيئة نسمح — للاستخدام المحلي.)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  // الخطوة 2: جلب الاتصالات المستحقة (بلا معرّف مستخدم = للجميع).
  const due = await findDueConnections();
  // الخطوة 3: تنفيذ المزامنة لكل اتصال وجمع النتائج.
  const results = [];
  for (const conn of due) {
    const r = await runSyncConnection(conn);
    results.push(r);
  }

  // الخطوة 4: إرجاع عدد المزامنات المنفذة ونتائجها.
  return NextResponse.json({ ok: true, synced: results.length, results });
}
