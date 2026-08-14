/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/google-sync.ts

وظيفة الملف:
مزامنة اختيارية مع Google Drive / Sheets عبر "Web App" من
Apps Script: نرسل البيانات والصور ليُرَفع الملف إلى درايف
وتُكتب البيانات في جدول إكسل خاص بالمشروع.

لماذا نحتاجه؟
بعض المختصين يريدون نسخة احتياطية أو نسخة عمل في Google Sheets.
الملف هو "الجسر" الذي يرسل البيانات من موقعنا إلى حساب جوجل.

متى يعمل؟
- عند تحليل وجبة تحتوي صورًا (رفع صورة + بيانات).
- عند إنشاء تقارير (خطة/مكملات/تقرير إداري).
- عند رفع صورة شخصية.

من يستدعيه؟
واجهات API التي تتعامل مع تحليل الوجبات والتقارير وصور الملف الشخصي.

الملفات التي يتعامل معها:
- لا يستورد من ملفات المشروع — يستخدم fetch (مدمج في Next.js)
  للتواصل مع رابط Apps Script.

ملاحظة مهمة:
لا يعمل هذا الملف إلا إذا وُجد متغير البيئة GOOGLE_APPSCRIPT_URL.
أي فشل يُرجِع { ok: false } دون كسر الطلب الأصلي
(best-effort — لا نوقف العمل الأساسي بسبب مشكلة المزامنة).

ترتيب العمل:
استدعاء syncToGoogleDrive ← إرسال POST للرابط ← قراءة الرد ←
إرجاع { ok, photoIds }
=================================================
*/

/**
 * مزامنة اختيارية مع Google Drive / Sheets عبر Apps Script Web App.
 * تُنفَّذ من الخادم فقط، وبطريقة غير حاجبة (best-effort) — أي فشل لا يعطل الطلب الأصلي.
 * تُفعَّل فقط عند ضبط GOOGLE_APPSCRIPT_URL في متغيرات البيئة.
 */

// ========================================
// 1. أنواع بيانات الإرسال
// ========================================

// DriveSyncPhoto: شكل "صورة واحدة" تُرسل إلى درايف
// (اسم الملف + نوعه MIME + محتواه Base64 + مجلد اختياري).
export type DriveSyncPhoto = {
  fileName: string;
  mimeType: string;
  base64: string;
  folder?: string;
};

// DriveSyncPayload: "الطرد" الكامل المرسل — نوع العملية
// (تحليل وجبة / ملف سباح / تقرير / صورة شخصية) + البيانات
// + الصور الاختيارية.
export type DriveSyncPayload = {
  type: 'meal-analysis' | 'swimmer-profile' | 'report' | 'avatar';
  data: Record<string, unknown>;
  photos?: DriveSyncPhoto[];
};

// DriveSyncResult: شكل الرد — ok تعني نجحت المزامنة،
// و photoIds معرّفات الملفات المرفوعة في درايف (إن دعمها السكربت).
export type DriveSyncResult = {
  ok: boolean;
  photoIds?: string[];
};

// ========================================
// 2. دوال المزامنة مع جوجل
// ========================================

/**
 * يرسل البيانات (وصور) إلى Web App الخاص بـ Apps Script
 * لرفع الصور إلى Google Drive وكتابة البيانات في Excel.
 * يرجع { ok, photoIds } — photoIds معرّفات درايف للملفات المرفوعة (عند دعم السكربت لها).
 */
/*
-----------------------------------------
الدالة: syncToGoogleDrive (مصدَّرة)
-----------------------------------------
وظيفتها: إرسال البيانات (والصور) إلى Web App الخاص بـ Apps Script
         لرفع الصور إلى Google Drive وكتابة البيانات في Excel.
Input: payload (نوع العملية + البيانات + الصور).
Processing: إن لم يوجد رابط في البيئة نعود فورًا { ok: false }؛
            وإلا نرسل POST بالبيانات كـ JSON، ثم نحلل الرد.
Output: { ok, photoIds } — photoIds معرّفات درايف للملفات
        المرفوعة (عند دعم السكربت لها).
يستدعيها: واجهات API الخاصة بالوجبات والتقارير وصور الملف الشخصي.
ماذا تستدعي: fetch (مدمج في Next.js).
-----------------------------------------
*/
export async function syncToGoogleDrive(payload: DriveSyncPayload): Promise<DriveSyncResult> {
  const url = process.env.GOOGLE_APPSCRIPT_URL;
  if (!url) return { ok: false };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; photoIds?: unknown };
    return {
      ok: data.ok === true,
      photoIds: Array.isArray(data.photoIds) ? (data.photoIds as string[]) : [],
    };
  } catch {
    return { ok: false };
  }
}

/*
-----------------------------------------
الدالة: driveFileUrl (مصدَّرة)
-----------------------------------------
وظيفتها: بناء رابط "عرض مباشر" لملف مرفوع في درايف.
Input: fileId (معرّف الملف).
Processing: تضمين المعرّف في رابط العرض الرسمي بعد ترميزه
            (encodeURIComponent للأحرف الخاصة).
Output: رابط يعرض الملف عندما يكون عامًا بالرابط.
يستدعيها: الصفحات/واجهات API لعرض الصور المرفوعة.
-----------------------------------------
*/
/** رابط عرض مباشر لملف درايف (يعمل عندما يكون الملف عامًا بالرابط). */
export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

/**
 * حفظ تقرير/ملف (PDF أو Excel) داخل فولدر السباح في Google Drive.
 * يُستخدم من مسارات تنزيل التقارير.
 */
/*
-----------------------------------------
الدالة: saveReportToDrive (مصدَّرة)
-----------------------------------------
وظيفتها: حفظ تقرير/ملف (PDF أو Excel) داخل "فولدر السباح" في درايف.
Input: params (اسم السباح + نوع التقرير + اسم الملف + نوعه + محتواه Base64).
Processing: تبني حزمة من نوع report وتستدعي syncToGoogleDrive
            مع الصورة/الملف داخل فولدر reports.
Output: boolean (true عند النجاح).
يستدعيها: مسارات تنزيل/تصدير التقارير.
ماذا تستدعي: syncToGoogleDrive (في نفس الملف).
-----------------------------------------
*/
export async function saveReportToDrive(params: {
  swimmerName: string;
  kind: 'plan' | 'supplement' | 'admin-report';
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<boolean> {
  const result = await syncToGoogleDrive({
    type: 'report',
    data: {
      swimmerName: params.swimmerName,
      kind: params.kind,
      fileName: params.fileName,
    },
    photos: [
      {
        fileName: params.fileName,
        mimeType: params.mimeType,
        base64: params.base64,
        folder: 'reports',
      },
    ],
  });
  return result.ok;
}
