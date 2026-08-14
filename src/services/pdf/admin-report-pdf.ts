/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/pdf/admin-report-pdf.ts

وظيفة الملف:
"توليد PDF عربي لتقارير الأدمن" — يبني جدولًا يعرض التزام
السباحين الغذائي (سعرات/بروتين/كربوهيدرات/دهون/ماء/أيام نشطة)،
بالإضافة إلى تصدير CSV متوافق مع Excel العربي.

لماذا نحتاجه؟
يحتاج الأدمن تقريرًا جاهزًا للطباعة أو التحميل لمراجعة التزام
السباحين بخططهم دون فتح قاعدة البيانات.

متى يعمل؟
من لوحة تحكم الأدمن عند طلب تقرير الالتزام (PDF أو CSV).

من يستدعي هذا الملف؟
واجهة API خاصة بالأدمن (src/app/api/admin/...) التي تبني التقرير.

الملفات التي يتعامل معها:
- ./plan-pdf → getPdfPrinter (الطابعة)، getLogoDataUri (الشعار)،
  applyRtlNode و toRtl (معالجة النص العربي من اليمين لليسار).
- pdfmake (مكتبة خارجية) لتوليد PDF.

ترتيب العمل:
الأدمن يطلب التقرير ↓
تُبنى صفوف الجدول من بيانات السباحين ↓
يُبنى مستند PDF (ترويسة + شعار + جدول + تذييل) ↓
تُطبق معالجة RTL على كل النصوص ↓
يُحوَّل التدفق الناتج إلى Buffer جاهز للتحميل

ملاحظة مهمة:
هذه طبقة "منطق أعمال" للعرض والتقارير فقط.
==================================================
*/

/**
 * توليد PDF عربي لتقارير الأدمن (الالتزام الغذائي للسباحين)
 * عبر pdfmake بنفس خط Cairo ولوجو الأكاديمية.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// pdfmake: مكتبة خارجية تولد ملفات PDF برمجيًا (من node_modules).
import PdfPrinter from 'pdfmake';
// دوال مساعدة من ملف plan-pdf في نفس المجلد (ملف محلي):
// getPdfPrinter → كائن الطابعة الجاهز، getLogoDataUri → الشعار،
// applyRtlNode → عكس النصوص العربية، toRtl → عكس نص واحد.
import { getPdfPrinter, getLogoDataUri, applyRtlNode, toRtl } from './plan-pdf';

// ========================================
// 2. أنواع البيانات
// ========================================

// صف واحد في تقرير الأدمن: بيانات سباح + نسب التزامه بالأرقام.
export interface AdminReportRow {
  name: string;
  email: string;
  planTitle?: string | null;
  caloriesPct: number | null;
  proteinPct: number | null;
  carbsPct: number | null;
  fatPct: number | null;
  waterPct: number | null;
  activeDays7: number;
  todayCalories: number;
  todayProtein: number;
  todayWaterMl: number;
}

// ========================================
// 3. توليد PDF تقرير الأدمن
// ========================================

/*
-----------------------------------------
الدالة: buildAdminReportPdf
-----------------------------------------
وظيفتها: بناء مستند PDF جاهز بجدول التزام السباحين.
Input: العنوان، العنوان الفرعي، وصفوف السباحين.
Processing:
  1. جلب الطابعة والشعار من plan-pdf.
  2. بناء خلايا الجدول (الترويسة والصفوف) مع الألوان.
  3. بناء مستند pdfmake: ترويسة بشعار، جدول، تذييل صفحات.
  4. تطبيق RTL على كل محتوى المستند.
  5. تجميع أجزاء التدفق في Buffer.
Output: Buffer (محتوى ملف PDF).
من يستدعيها؟ واجهة تقارير الأدمن.
ماذا تستدعي هي؟ getPdfPrinter، getLogoDataUri، applyRtlNode، toRtl.
-----------------------------------------
*/
export async function buildAdminReportPdf(opts: {
  title: string;
  subtitle: string;
  rows: AdminReportRow[];
}): Promise<Buffer> {
  // كائن الطابعة (يُهيأ مرة واحدة) والشعار كبيانات base64.
  const printer = getPdfPrinter();
  const logo = getLogoDataUri();

  // تحويل قيمة نسبة إلى نص (— عندما تكون null، وإلا رقم%).
  const pctText = (v: number | null) => (v === null ? '—' : `${v}%`);

  // خلايا ترويسة الجدول: عناوين عربية بخط عريض وخلفية زرقاء داكنة.
  const headerCells = ['السباح', 'الخطة', 'سعرات', 'بروتين', 'كارب', 'دهون', 'ماء', 'أيام (7)'].map((t) =>
    ({ text: toRtl(t), bold: true, color: '#ffffff', fillColor: '#0e3552', fontSize: 9, alignment: 'right' } as object)
  );

  // بناء صف كل سباح: الاسم والخطة والنسب المئوية.
  const body: object[][] = opts.rows.map((r) => [
    { text: toRtl(r.name), fontSize: 9, alignment: 'right' } as object,
    { text: toRtl(r.planTitle ?? 'بدون خطة'), fontSize: 8, color: '#475569', alignment: 'right' } as object,
    { text: pctText(r.caloriesPct), fontSize: 9, alignment: 'center' } as object,
    { text: pctText(r.proteinPct), fontSize: 9, alignment: 'center' } as object,
    { text: pctText(r.carbsPct), fontSize: 9, alignment: 'center' } as object,
    { text: pctText(r.fatPct), fontSize: 9, alignment: 'center' } as object,
    { text: pctText(r.waterPct), fontSize: 9, alignment: 'center' } as object,
    { text: `${r.activeDays7}/7`, fontSize: 9, alignment: 'center' } as object,
  ]);

  // مستند pdfmake: ترويسة (عنوان + شعار) ثم جدول ثم تذييل بالصفحات.
  const doc = {
    content: [
      {
        columns: [
          {
            stack: [
              { text: toRtl(opts.title), fontSize: 15, bold: true, color: '#0e3552', alignment: 'right' },
              { text: toRtl(opts.subtitle), fontSize: 9, color: '#64748b', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: toRtl(`إجمالي السباحين: ${opts.rows.length}`), fontSize: 9, color: '#0e3552', alignment: 'right', margin: [0, 4, 0, 0] },
            ],
            width: '*',
          },
          logo
            ? ({ image: logo, width: 44, height: 44, alignment: 'left' } as object)
            : { text: '', width: 44 },
        ],
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [headerCells, ...body],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    defaultStyle: { font: 'Cairo', fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'Top Academy – Smart Swimmer Nutrition', fontSize: 7, color: '#94a3b8', alignment: 'right', margin: [36, 10, 0, 0] },
        { text: `الصفحة ${currentPage} من ${pageCount}`, fontSize: 7, color: '#94a3b8', alignment: 'left', margin: [0, 10, 36, 0] },
      ],
    }) as object,
  } as object;

  // نطبق معالجة RTL على كل محتوى المستند (نصوص عربية تُعرض يمينًا).
  const rtlDoc = doc as Record<string, unknown>;
  (rtlDoc.content as unknown[]).forEach((item) => applyRtlNode(item));

  // تشغيل الطابعة وتجميع أجزاء الملف في Buffer.
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = printer.createPdfKitDocument(rtlDoc as unknown as Parameters<PdfPrinter['createPdfKitDocument']>[0]);
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    stream.end();
  });
}

// ========================================
// 4. تصدير CSV
// ========================================

/*
-----------------------------------------
الدالة: buildCsv
-----------------------------------------
وظيفتها: بناء نص CSV يفتح بشكل صحيح في Excel العربي.
Processing:
  - escape: وضع القيم المحتوية على " ; أو سطر جديد بين علامتي اقتباس.
  - الفصل بفاصلة منقوطة (؛ بدل ,) لتوافق Excel العربي.
  - إضافة BOM (\uFEFF) في البداية حتى تظهر الحروف العربية صحيحة.
  - أسطر مفصولة بـ \r\n (نظام Windows).
Output: نص CSV كامل جاهز للتحميل.
من يستدعيها؟ واجهة تصدير CSV في لوحة الأدمن.
-----------------------------------------
*/
/** نص CSV بتنسيق متوافق مع Excel العربي (BOM + فاصلة منقوطة). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  // تهريب أي قيمة فيها " أو ; أو سطر جديد بين علامتي اقتباس.
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // السطر الأول = العناوين، ثم بقية الصفوف، كلها مفصولة بفاصلة منقوطة.
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  // BOM في البداية ليعرف Excel أن الملف نص عربي، وأسطر على نمط Windows.
  return '\uFEFF' + lines.join('\r\n');
}
