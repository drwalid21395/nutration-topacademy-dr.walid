/**
 * ============================================================
 * Top Academy – Smart Swimmer Nutrition | Google Drive Sync
 * ============================================================
 * ربط الموقع بفولدر Google Drive + ورقة Excel في Google Sheets.
 * النسخة المطوّرة: فولدر خاص لكل سباح يحتوي وجباته وتقاريره.
 *
 * خطوات التفعيل/التحديث:
 * 1) افتح مشروع Apps Script (من ملف الإكسيل أو console.script.google.com)
 * 2) احذف أي محتوى والصق هذا الكود كاملًا (احتفظ بنفس DRIVE_FOLDER_ID)
 * 3) حفظ → Deploy (نشر) → Manage deployments (إدارة عمليات النشر) → ✏️ تحرير → Version: New version → Deploy
 *    - Execute as (التنفيذ باسم): Me (أنا)
 *    - Who has access (الوصول): Anyone (أي شخص)
 * 4) لا يتغير رابط التطبيق (يظل نفسه) — الموقع يعمل تلقائيًا.
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
  'فولدر السباح',
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

/** أعمدة ورقة التقارير المحمّلة */
const REPORT_COLUMNS = [
  'Timestamp',
  'الاسم',
  'نوع التقرير',
  'اسم الملف',
  'رابط درايف',
];

const SHEET_NAMES = {
  mealAnalysis: 'تحليل_الوجبات',
  swimmerProfile: 'السباحون',
  reports: 'التقارير',
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
        return savePhoto_(p, type, data);
      });
    }

    const result = appendRow_(type, data, photoIds);
    return json_({ ok: true, sheet: result.sheet, photoIds: photoIds });
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 400);
  }
}

/**
 * مسار فولدر السباح داخل الفولدر الرئيسي:
 * سباحين/<اسم السباح>/<وجبات | تقارير>
 */
function swimmerFolderPath_(type, data) {
  const base = 'سباحين';
  const name = (data.swimmerName || data.name || 'سباح').toString().replace(/[\\/:*?"<>|]/g, '-');
  const sub = type === 'report' || type === 'avatar' ? 'تقارير' : 'وجبات';
  return base + '/' + name + '/' + sub;
}

/** حفظ صورة/ملف داخل فولدر (يدعم مسار مجلدات متداخلة بفاصل /) */
function savePhoto_(photo, type, data) {
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const folderPath =
    type === 'meal-analysis' || type === 'report' || type === 'avatar'
      ? swimmerFolderPath_(type, data)
      : photo.folder && photo.folder !== ''
        ? photo.folder
        : '';
  const folder = folderPath === '' ? root : ensureFolderPath_(root, folderPath);

  const mime = photo.mimeType || 'image/jpeg';
  const fileName =
    photo.fileName || 'photo-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
  const bytes = Utilities.base64Decode(photo.base64);
  const blob = Utilities.newBlob(bytes, mime, fileName);
  const file = folder.createFile(blob);
  // مشاركة الملف بالرابط ليعرض في الموقع
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

/** إنشاء مجلدات متداخلة من مسار مثل: سباحين/أحمد/وجبات */
function ensureFolderPath_(root, path) {
  const parts = path.split('/').filter(function (s) {
    return s !== '';
  });
  let current = root;
  parts.forEach(function (part) {
    current = getOrCreateFolder_(current, part);
  });
  return current;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

/** كتابة صف بيانات في الورقة المناسبة (مع إنشاء الورقة إذا لم توجد) */
function appendRow_(type, data, photoIds) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let columns;
  let sheetName;
  if (type === 'meal-analysis') {
    columns = MEAL_COLUMNS;
    sheetName = SHEET_NAMES.mealAnalysis;
  } else if (type === 'report') {
    columns = REPORT_COLUMNS;
    sheetName = SHEET_NAMES.reports;
  } else {
    columns = SWIMMER_COLUMNS;
    sheetName = SHEET_NAMES.swimmerProfile;
  }

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
  if (type === 'meal-analysis') {
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
      pick('swimmerName'),
    ];
  } else if (type === 'report') {
    row = [
      timestamp,
      pick('swimmerName'),
      pick('kind'),
      pick('fileName'),
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
