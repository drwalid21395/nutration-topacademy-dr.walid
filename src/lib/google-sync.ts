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
  type: 'meal-analysis' | 'swimmer-profile' | 'report' | 'avatar';
  data: Record<string, unknown>;
  photos?: DriveSyncPhoto[];
};

export type DriveSyncResult = {
  ok: boolean;
  photoIds?: string[];
};

/**
 * يرسل البيانات (وصور) إلى Web App الخاص بـ Apps Script
 * لرفع الصور إلى Google Drive وكتابة البيانات في Excel.
 * يرجع { ok, photoIds } — photoIds معرّفات درايف للملفات المرفوعة (عند دعم السكربت لها).
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

/** رابط عرض مباشر لملف درايف (يعمل عندما يكون الملف عامًا بالرابط). */
export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

/**
 * حفظ تقرير/ملف (PDF أو Excel) داخل فولدر السباح في Google Drive.
 * يُستخدم من مسارات تنزيل التقارير.
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
