/**
 * ============================================================
 * Top Academy – Smart Swimmer Nutrition | Google Drive Sync
 * ============================================================
 * ربط الموقع بفولدر Google Drive + ورقة Excel في Google Sheets.
 *
 * خطوات التفعيل:
 * 1) افتح ملف الإكسيل في المتصفح: Extensions (الإضافات) → Apps Script
 * 2) احذف أي محتوى والصق هذا الكود كاملًا
 * 3) عدّل DRIVE_FOLDER_ID إلى رقم الفولدر الخاص بك (من رابط الفولدر)
 * 4) حفظ → Deploy (نشر) → New deployment (نشر جديد) → Web app
 *    - Execute as (التنفيذ باسم): Me (أنا)
 *    - Who has access (الوصول): Anyone (أي شخص)
 * 5) انسخ Web app URL (رابط تطبيق الويب) وضعه في:
 *    متغير البيئة GOOGLE_APPSCRIPT_URL في الموقع
 * ============================================================
 */

/** معرّف فولدر صور السباحين على Google Drive (من رابط الفولدر) */
const DRIVE_FOLDER_ID = '1VHfsj7mwNJ6JgIE8ekfPQexSBsEmEipg';

/** أعمدة ورقة تحليل الوجبات */
const MEAL_COLUMNS = [
  'Timestamp',
  'الاسم',
  'البريد',
  'رقم التحليل',
  'المزود',
  'الثقة %',
  'السعرات',
  'بروتين جم',
  'كربوهيدرات جم',
  'دهون جم',
  'ألياف جم',
  'صوديوم ملجم',
  'ملاحظات',
  'الأطعمة (JSON)',
  'رابط صورة درايف',
];

/** أعمدة ورقة بيانات السباحين */
const SWIMMER_COLUMNS = [
  'Timestamp',
  'الاسم',
  'البريد',
  'الاسم الكامل',
  'العمر',
  'الجنس',
  'الوزن كجم',
  'الطول سم',
  'نسبة الدهون',
  'الهدف',
  'المستوى',
  'التخصص',
  'المسافات',
  'الحالات المزمنة',
  'تحذير طبي',
];

const SHEET_NAMES = {
  mealAnalysis: 'تحليل_الوجبات',
  swimmerProfile: 'السباحون',
};

function doGet() {
  return json_({
    ok: true,
    service: 'top-academy-drive-sync',
    time: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type || 'generic';
    const data = payload.data || {};

    let photoIds = [];
    if (Array.isArray(payload.photos) && payload.photos.length > 0) {
      photoIds = payload.photos.map(function (p) {
        return savePhoto_(p);
      });
    }

    const result = appendRow_(type, data, photoIds);
    return json_({ ok: true, sheet: result.sheet, photoIds: photoIds });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 400);
  }
}

/** حفظ صورة داخل فولدر درايف (مع إمكانية مجلد فرعي) */
function savePhoto_(photo) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const sub =
    photo.folder && photo.folder !== ''
      ? getOrCreateFolder_(folder, photo.folder)
      : folder;
  const mime = photo.mimeType || 'image/jpeg';
  const fileName =
    photo.fileName || 'photo-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
  const bytes = Utilities.base64Decode(photo.base64);
  const blob = Utilities.newBlob(bytes, mime, fileName);
  const file = sub.createFile(blob);
  return file.getId();
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

/** كتابة صف بيانات في الورقة المناسبة (مع إنشاء الورقة إذا لم توجد) */
function appendRow_(type, data, photoIds) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const isMeal = type === 'meal-analysis';
  const columns = isMeal ? MEAL_COLUMNS : SWIMMER_COLUMNS;
  const sheetName = isMeal ? SHEET_NAMES.mealAnalysis : SHEET_NAMES.swimmerProfile;

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.setFrozenRows(1);
    sheet.appendRow(columns);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
  }

  const timestamp = new Date().toISOString();
  const pick = function (k) {
    return data[k] !== undefined && data[k] !== null ? data[k] : '';
  };

  let row;
  if (isMeal) {
    const foods = pick('foods');
    row = [
      timestamp,
      pick('name'),
      pick('email'),
      pick('analysisId'),
      pick('provider'),
      pick('confidence'),
      pick('totalCalories'),
      pick('totalProteinG'),
      pick('totalCarbsG'),
      pick('totalFatG'),
      pick('totalFiberG'),
      pick('totalSodiumMg'),
      pick('notes'),
      typeof foods === 'string' ? foods : JSON.stringify(foods),
      photoIds.join(', '),
    ];
  } else {
    row = [
      timestamp,
      pick('name'),
      pick('email'),
      pick('fullName'),
      pick('age'),
      pick('gender'),
      pick('weightKg'),
      pick('heightCm'),
      pick('bodyFatPercent'),
      pick('goal'),
      pick('swimmerLevel'),
      pick('specialty'),
      pick('mainDistances'),
      pick('chronicConditions'),
      pick('medicalAlert'),
    ];
  }

  sheet.appendRow(row);
  return { sheet: sheetName };
}

function json_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
