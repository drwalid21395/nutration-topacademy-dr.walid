/**
 * مزامنة اختيارية مع Google Drive / Sheets عبر Apps Script Web App.
 * تُنفَّذ من الخادم فقط، وبطريقة غير حاجبة (best-effort) — أي فشل لا يعطل الطلب الأصلي.
 * تُفعَّل فقط عند ضبط GOOGLE_APPSCRIPT_URL في متغيرات البيئة.
 */

export type DriveSyncPhoto = {
  fileName: string;
  mimeType: string;
  base64: string;
  folder?: string;
};

export type DriveSyncPayload = {
  type: 'meal-analysis' | 'swimmer-profile';
  data: Record<string, unknown>;
  photos?: DriveSyncPhoto[];
};

/**
 * يرسل البيانات (وصور) إلى Web App الخاص بـ Apps Script
 * لرفع الصور إلى Google Drive وكتابة البيانات في Excel.
 * يرجع true عند النجاح، وfalse إذا لم يُضبط الرابط أو فشل الإرسال.
 */
export async function syncToGoogleDrive(payload: DriveSyncPayload): Promise<boolean> {
  const url = process.env.GOOGLE_APPSCRIPT_URL;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}
