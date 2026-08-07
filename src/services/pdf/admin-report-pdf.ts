/**
 * توليد PDF عربي لتقارير الأدمن (الالتزام الغذائي للسباحين)
 * عبر pdfmake بنفس خط Cairo ولوجو الأكاديمية.
 */
import PdfPrinter from 'pdfmake';
import { getPdfPrinter, getLogoDataUri, applyRtlNode, toRtl } from './plan-pdf';

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

export async function buildAdminReportPdf(opts: {
  title: string;
  subtitle: string;
  rows: AdminReportRow[];
}): Promise<Buffer> {
  const printer = getPdfPrinter();
  const logo = getLogoDataUri();

  const pctText = (v: number | null) => (v === null ? '—' : `${v}%`);

  const headerCells = ['السباح', 'الخطة', 'سعرات', 'بروتين', 'كارب', 'دهون', 'ماء', 'أيام (7)'].map((t) =>
    ({ text: toRtl(t), bold: true, color: '#ffffff', fillColor: '#0e3552', fontSize: 9, alignment: 'right' } as object)
  );

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

  const rtlDoc = doc as Record<string, unknown>;
  (rtlDoc.content as unknown[]).forEach((item) => applyRtlNode(item));

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = printer.createPdfKitDocument(rtlDoc as unknown as Parameters<PdfPrinter['createPdfKitDocument']>[0]);
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    stream.end();
  });
}

/** نص CSV بتنسيق متوافق مع Excel العربي (BOM + فاصلة منقوطة). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  return '\uFEFF' + lines.join('\r\n');
}
