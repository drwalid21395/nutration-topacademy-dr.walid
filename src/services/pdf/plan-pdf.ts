/**
 * توليد PDF عربي احترافي للخطط الغذائية عبر pdfmake مع خط Cairo.
 * ملاحظة: pdfmake لا يدعم استيراد واجهات JSON من نسخة TS مباشرة،
 * لذا نستخدم واجهة مناسبة للنسخة 0.2.
 */
import path from 'path';
import fs from 'fs';
import PdfPrinter from 'pdfmake';

let printerInstance: PdfPrinter | null = null;

let logoDataUri: string | null | undefined;

/** لوجو الأكاديمية كـ data URI لدمجه في رأس ملفات PDF (مع التخزين المؤقت). */
export function getLogoDataUri(): string | null {
  if (logoDataUri !== undefined) return logoDataUri;
  try {
    const p = path.join(process.cwd(), 'public', 'images', 'academy-logo.png');
    logoDataUri = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  } catch {
    logoDataUri = null;
  }
  return logoDataUri;
}

export function getPdfPrinter(): PdfPrinter {
  if (!printerInstance) {
    const cairoPath = path.join(process.cwd(), 'src', 'services', 'pdf', 'fonts', 'Cairo.ttf');
    printerInstance = new PdfPrinter({
      Cairo: { normal: cairoPath, bold: cairoPath, italics: cairoPath, bolditalics: cairoPath },
    } as unknown as ConstructorParameters<typeof PdfPrinter>[0]);
  }
  return printerInstance;
}

export interface PdfPlanData {
  swimmerName: string;
  swimmerImage?: string;
  issueDate: string;
  planDuration: string;
  goal?: string;
  gender: string;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  level?: string;
  swimSessions?: number | null;
  gymSessions?: number | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  waterMl?: number | null;
  meals: { day: number; type: string; title: string; timing?: string; calories?: number | null; items: { name: string; qty: string; cals: number }[] }[];
  shoppingList: string[];
  alternativesNote?: string;
  competitionNotes?: string[];
  safetyNotes: string[];
  version: string;
  planUrl?: string;
  includeSupplements?: boolean;
  supplementsSection?: string[];
}

const color = {
  ocean: '#0e3552',
  oceanLight: '#155480',
  gold: '#b8862c',
  slate: '#475569',
  line: '#cbd5e1',
};

function cell(text: string | number, opts: { bold?: boolean; color?: string; align?: string } = {}) {
  return {
    text: String(text),
    fontSize: 9,
    bold: opts.bold ?? false,
    color: opts.color ?? '#0f172a',
    alignment: opts.align ?? 'right',
  } as object;
}

/** هل النص يحتوي على حروف عربية؟ */
function isArabic(s: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}

/**
 * إعادة ترتيب النص العربي ليعرض من اليمين إلى اليسار داخل PDF.
 * pdfmake لا يدعم RTL أصلًا، لذا نعكس ترتيب الكلمات لكل سطر عربي
 * مع إبقاء الأسطر اللاتينية/الرقمية كما هي (الأشكال الحرفية يعالجها PDFKit).
 */
export function toRtl(text: string): string {
  if (!text || !isArabic(text)) return text;
  return text
    .split('\n')
    .map((line) => (isArabic(line) ? line.split(' ').reverse().join(' ') : line))
    .join('\n');
}

/** تجول في شجرة المستند وعكس النصوص العربية (دون لمس الصور/الأرقام). */
export function applyRtlNode(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  if (typeof n.text === 'string') n.text = toRtl(n.text);
  for (const key of Object.keys(n)) {
    const v = n[key];
    if (Array.isArray(v)) v.forEach((item) => applyRtlNode(item));
    else if (v && typeof v === 'object') applyRtlNode(v);
  }
}

export async function buildPlanPdf(data: PdfPlanData): Promise<Buffer> {
  const printer = getPdfPrinter();

  // QR لفتح الخطة الرقمية (اختياري — عند توفر رابط)
  let qrImage: string | null = null;
  if (data.planUrl) {
    try {
      const res = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(data.planUrl)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        qrImage = `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      qrImage = null;
    }
  }

  // تجميع الوجبات حسب اليوم
  const days = new Map<number, typeof data.meals>();
  data.meals.forEach((m) => {
    if (!days.has(m.day)) days.set(m.day, []);
    days.get(m.day)!.push(m);
  });

  const dayTables = Array.from(days.entries()).map(([day, meals]) => {
    const rows = meals.map((m) => {
      const itemText = m.items.map((it) => `${it.name} (${it.qty})`).join('\n');
      return [cell(m.timing ?? ''), cell(m.calories ?? '—'), cell(itemText), cell(m.title, { bold: true, color: color.ocean }), cell(`اليوم ${day}`, { bold: true })];
    });
    return {
      layout: 'lightHorizontalLines',
      table: {
        headerRows: 1,
        widths: ['20%', '12%', '44%', '16%', '8%'],
        body: [
          [cell('التوقيت', { bold: true, color: color.oceanLight }), cell('سعرات', { bold: true, color: color.oceanLight }), cell('المكونات والكميات', { bold: true, color: color.oceanLight }), cell('الوجبة', { bold: true, color: color.oceanLight }), cell('اليوم', { bold: true, color: color.oceanLight })].map((c) => ({ ...(c as object), fillColor: '#eef2f6' })),
          ...rows,
        ],
      },
      margin: [0, 0, 0, 10] as [number, number, number, number],
    } as object;
  });

  const doc = {
    info: {
      title: `الخطة الغذائية — ${data.swimmerName}`,
      author: 'Top Academy – Smart Swimmer Nutrition',
      subject: 'خطة تغذية رياضية للسباحين',
    },
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 50] as [number, number, number, number],
    content: [
      // الترويسة
      {
        columns: [
          {
            alignment: 'right',
            stack: [
              { text: `إصدار الخطة: ${data.version}`, fontSize: 8, color: color.slate },
              { text: `تاريخ الإصدار: ${data.issueDate}`, fontSize: 8, color: color.slate },
              { text: 'واتساب: 01500026288', fontSize: 8, color: color.slate, margin: [0, 4, 0, 0] },
            ],
          },
          {
            stack: [
              { text: 'TOP ACADEMY', fontSize: 20, bold: true, color: color.ocean },
              { text: 'Smart Swimmer Nutrition', fontSize: 9, color: color.oceanLight, margin: [0, 2, 0, 0] },
              { text: 'إعداد وإشراف: د. وليد عبد الرحمن عبد الظاهر', fontSize: 8.5, color: color.gold, margin: [0, 4, 0, 0] },
            ],
          },
          ...(getLogoDataUri() ? [{ image: getLogoDataUri(), width: 48, alignment: 'center' }] : []),
        ],
        columnGap: 12,
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: color.gold }], margin: [0, 8, 0, 16] } as object,

      // العنوان
      { text: 'الخطة الغذائية المخصصة', fontSize: 16, bold: true, color: color.ocean, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: `السباح: ${data.swimmerName}`, fontSize: 11, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: `مدة الخطة: ${data.planDuration}${data.goal ? ` · الهدف: ${data.goal}` : ''}`, fontSize: 9, color: color.slate, alignment: 'center', margin: [0, 0, 0, 14] },

      // البيانات الشخصية
      {
        columns: [
          { width: '50%', stack: [sectionHeader('التدريب والاحتياجات'), keyValue('مستوى السباح', data.level), keyValue('تمرينات سباحة/أسبوع', data.swimSessions), keyValue('تمرينات لياقة/أسبوع', data.gymSessions), keyValue('احتياج الماء اليومي', data.waterMl ? `${(data.waterMl / 1000).toFixed(1)} لتر` : '—')] },
          { width: '50%', stack: [sectionHeader('بيانات السباح'), keyValue('العمر', data.age), keyValue('الجنس', data.gender), keyValue('الطول', data.heightCm ? `${data.heightCm} سم` : '—'), keyValue('الوزن', data.weightKg ? `${data.weightKg} كجم` : '—')] },
        ],
        columnGap: 20,
        margin: [0, 0, 0, 10],
      } as object,

      // السعرات والمغذيات
      {
        columns: [
          { width: '34%', stack: [macroBox('كربوهيدرات / دهون', `${data.carbsG ?? '—'} جم / ${data.fatG ?? '—'} جم`)] },
          { width: '33%', stack: [macroBox('البروتين', data.proteinG ? `${data.proteinG} جم` : '—')] },
          { width: '33%', stack: [macroBox('السعرات اليومية', data.calories ? `${data.calories} سعرة` : '—')] },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 16],
      } as object,

      // جدول الوجبات
      { text: 'جدول الوجبات', fontSize: 13, bold: true, color: color.ocean, margin: [0, 0, 0, 8] },
      ...dayTables,

      // البدائل
      {
        stack: [
          sectionHeader('البدائل الغذائية'),
          { text: data.alternativesNote ?? 'يمكن استبدال أي مكون ببديل مماثل من نفس المجموعة الغذائية مع مراعاة الحساسية.', fontSize: 9, color: color.slate, margin: [0, 0, 0, 8] },
        ],
      },

      // قائمة المشتريات
      {
        columns: [
          {
            width: '50%',
            stack: [
              sectionHeader('نصائح السلامة وحفظ الطعام'),
              ...data.safetyNotes.map((s) => ({ text: `• ${s}`, fontSize: 9, color: '#1e293b', margin: [0, 0, 0, 2] })),
            ],
          },
          {
            width: '50%',
            stack: [
              sectionHeader('قائمة المشتريات الأسبوعية'),
              ...data.shoppingList.map((s) => ({ text: `• ${s}`, fontSize: 9, color: '#1e293b', margin: [0, 0, 0, 2] })),
            ],
          },
        ],
        columnGap: 20,
        margin: [0, 0, 0, 10],
      } as object,

      // توصيات البطولة
      ...(data.competitionNotes && data.competitionNotes.length > 0
        ? [
            {
              stack: [
                sectionHeader('توصيات البطولة'),
                ...data.competitionNotes.map((s) => ({ text: `• ${s}`, fontSize: 9, color: '#1e293b', margin: [0, 0, 0, 2] })),
                { text: 'تحذير: لا تجرّب أطعمة أو مكملات جديدة يوم البطولة.', fontSize: 9, bold: true, color: '#b91c1c', margin: [0, 6, 0, 0] },
              ],
              margin: [0, 0, 0, 10],
            },
          ]
        : []),

      // المكملات التثقيفية (اختياري)
      ...(data.includeSupplements && data.supplementsSection && data.supplementsSection.length > 0
        ? [
            {
              stack: [
                sectionHeader('إشارة للمكملات (معلومات تثقيفية عامة)'),
                ...data.supplementsSection.map((s) => ({ text: `• ${s}`, fontSize: 9, color: '#1e293b', margin: [0, 0, 0, 2] })),
                { text: 'لا تُتخذ المكملات إلا بعد استشارة الطبيب أو اختصاصي التغذية الرياضية والتحقق من لوائح مكافحة المنشطات.', fontSize: 8.5, bold: true, color: color.gold, margin: [0, 4, 0, 0] },
              ],
              margin: [0, 0, 0, 10],
            },
          ]
        : []),

      // إخلاء المسؤولية
      {
        stack: [
          { text: 'إخلاء مسؤولية طبية', fontSize: 10, bold: true, color: color.ocean, margin: [0, 0, 0, 4] },
          { text: 'هذه الخطة إرشادية وتقديرية لأغراض تعليمية، ولا تغني عن استشارة الطبيب أو اختصاصي التغذية، خصوصًا في حالات الأمراض المزمنة أو الحساسية أو القاصرين. لا تعد الخطة أداة تشخيص أو علاج.', fontSize: 8.5, color: color.slate, lineHeight: 1.5 },
        ],
        margin: [0, 8, 0, 10],
      },

      // التوقيع
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: color.line }],
        margin: [0, 4, 0, 12],
      } as object,
      {
        columns: [
          ...(qrImage ? [{ width: '30%', stack: [{ text: 'افتح الخطة الرقمية', fontSize: 7, color: color.slate, alignment: 'center', margin: [0, 0, 0, 3] }, { image: qrImage, width: 70, alignment: 'center' }] }] : []),
          { width: '50%', stack: [{ text: 'إعداد وإشراف', fontSize: 9, bold: true, color: color.ocean }, { text: 'د. وليد عبد الرحمن عبد الظاهر', fontSize: 11, bold: true, color: color.ocean }, { text: 'Top Academy — Smart Swimmer Nutrition', fontSize: 8, color: color.slate }] },
        ],
        columnGap: 20,
      } as object,
    ],
    defaultStyle: { font: 'Cairo', fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'Top Academy – Smart Swimmer Nutrition', fontSize: 7, color: '#94a3b8', alignment: 'right', margin: [36, 10, 0, 0] },
        { text: `الصفحة ${currentPage} من ${pageCount}`, fontSize: 7, color: '#94a3b8', alignment: 'left', margin: [0, 10, 36, 0] },
      ],
    }) as object,
  } as object;

  // تطبيق اتجاه RTL على كل نصوص المستند
  const rtlDoc = doc as Record<string, unknown>;
  (rtlDoc.content as unknown[]).forEach((item) => applyRtlNode(item));
  if (rtlDoc.footer) {
    const originalFooter = rtlDoc.footer as (a: number, b: number) => object;
    rtlDoc.footer = (currentPage: number, pageCount: number) => {
      const f = originalFooter(currentPage, pageCount);
      applyRtlNode(f);
      return f;
    };
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = printer.createPdfKitDocument(rtlDoc as unknown as Parameters<PdfPrinter['createPdfKitDocument']>[0]);
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    stream.end();
  });
}

function sectionHeader(text: string) {
  return { text, fontSize: 12, bold: true, color: color.ocean, margin: [0, 0, 0, 6] } as object;
}

function keyValue(k: string, v: string | number | null | undefined) {
  return {
    text: `${k}: ${v ?? '—'}`,
    fontSize: 9,
    color: '#1e293b',
    margin: [0, 0, 0, 2],
  } as object;
}

function macroBox(label: string, value: string) {
  return {
    stack: [
      { text: label, fontSize: 8, color: color.slate, alignment: 'center' },
      { text: value, fontSize: 13, bold: true, color: color.ocean, alignment: 'center', margin: [0, 3, 0, 0] },
    ],
    border: [true, true, true, true],
    borderColor: color.line,
    padding: [8, 8, 8, 8],
  } as object;
}
