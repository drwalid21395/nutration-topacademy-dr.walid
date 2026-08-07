/**
 * توليد PDF عربي لتقرير تقييم المكملات الذكي.
 * تقرير استرشادي غير علاجي — لا يصف ولا يشخص.
 */
import { getPdfPrinter, applyRtlNode } from './plan-pdf';
import type PdfPrinter from 'pdfmake';
import type { SupplementAssessmentOutput } from '@/services/supplements/types';
import { SUPPLEMENT_DISCLAIMER } from '@/lib/constants';

const color = {
  ocean: '#0e3552',
  oceanLight: '#155480',
  gold: '#b8862c',
  slate: '#475569',
  line: '#cbd5e1',
};

export interface SupplementPdfData {
  athleteName: string;
  gender: string;
  age?: number | null;
  weightKg?: number | null;
  issueDate: string;
  version: string;
  assessment: SupplementAssessmentOutput;
}

function cell(text: string | number, opts: { bold?: boolean; color?: string; align?: 'right' | 'left' | 'center' } = {}) {
  return {
    text: String(text),
    fontSize: 9,
    bold: opts.bold ?? false,
    color: opts.color ?? '#0f172a',
    alignment: opts.align ?? 'right',
  } as object;
}

function headerCell(text: string) {
  return { ...cell(text, { bold: true, color: color.oceanLight }), fillColor: '#eef2f6' } as object;
}

function sectionHeader(text: string) {
  return { text, fontSize: 13, bold: true, color: color.ocean, margin: [0, 0, 0, 8] } as object;
}

function bullet(text: string) {
  return { text: `• ${text}`, fontSize: 9, color: '#1e293b', margin: [0, 0, 0, 3] } as object;
}

const statusAr: Record<string, string> = {
  'food-first': 'غذاء أولًا',
  'needs-review': 'تحت المراجعة',
  blocked: 'محجوب',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

const statusColor: Record<string, string> = {
  'food-first': '#15803d',
  'needs-review': '#b45309',
  blocked: '#b91c1c',
};

export async function generateSupplementPdfReport(data: SupplementPdfData): Promise<Buffer> {
  const printer = getPdfPrinter();
  const a = data.assessment;

  const coverageRows = a.coverage.map((r) => [
    cell(r.deficit > 0 ? `${Math.round(r.deficit)} ${r.unit}` : '—'),
    cell(`${Math.round(r.coverageTotalPct)}%`),
    cell(`${Math.round(r.total)} ${r.unit}`),
    cell(`${Math.round(r.fromFood)} ${r.unit}`),
    cell(`${Math.round(r.requirement)} ${r.unit}`),
    cell(r.nameAr, { bold: true }),
  ]);

  const recommendationRows = a.recommendations.map((r) => [
    cell(r.medicalNote ?? '—'),
    cell(r.timingAr ?? '—'),
    cell(r.doseEstimate != null ? `${r.doseEstimate} ${r.doseUnit}` : '—'),
    cell(r.evidenceStrength),
    cell(statusAr[r.status] ?? r.status, { bold: true, color: statusColor[r.status] ?? color.slate }),
    cell(r.nameAr, { bold: true }),
  ]);

  const scheduleRows = a.schedule.map((s) => [
    cell(s.reason),
    cell(s.withFood ? 'نعم' : 'لا'),
    cell(s.dose),
    cell(s.item),
    cell(s.time, { bold: true }),
  ]);

  const doc = {
    info: {
      title: `تقرير تقييم المكملات — ${data.athleteName}`,
      author: 'Top Academy – Smart Swimmer Nutrition',
      subject: 'تقييم استرشادي للمكملات الغذائية',
    },
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 50] as [number, number, number, number],
    content: [
      {
        columns: [
          {
            alignment: 'right',
            stack: [
              { text: `الإصدار: ${data.version}`, fontSize: 8, color: color.slate },
              { text: `تاريخ الإصدار: ${data.issueDate}`, fontSize: 8, color: color.slate },
            ],
          },
          {
            stack: [
              { text: 'TOP ACADEMY', fontSize: 20, bold: true, color: color.ocean },
              { text: 'Smart Swimmer Nutrition', fontSize: 9, color: color.oceanLight, margin: [0, 2, 0, 0] },
              { text: 'إعداد وإشراف: د. وليد عبد الرحمن عبد الظاهر', fontSize: 8.5, color: color.gold, margin: [0, 4, 0, 0] },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: color.gold }], margin: [0, 8, 0, 16] } as object,

      { text: 'تقرير تقييم المكملات الذكي', fontSize: 16, bold: true, color: color.ocean, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: `السباح: ${data.athleteName}`, fontSize: 11, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
      {
        text: `${data.gender === 'male' ? 'ذكر' : 'أنثى'}${data.age ? ` · العمر ${data.age}` : ''}${data.weightKg ? ` · الوزن ${data.weightKg} كجم` : ''} · المستوى العام: ${a.overallLevel}`,
        fontSize: 9,
        color: color.slate,
        alignment: 'center',
        margin: [0, 0, 0, 14],
      },

      // الملخص
      {
        stack: [
          sectionHeader('الملخص'),
          { text: a.summary, fontSize: 9.5, color: '#1e293b', lineHeight: 1.6 },
          ...(a.needsMedicalApproval ? [{ text: 'تحذير: يتطلب هذا التقييم إشرافًا/موافقة مختص قبل أي استخدام.', fontSize: 9, bold: true, color: '#b91c1c', margin: [0, 6, 0, 0] }] : []),
          ...(a.needsGuardianConsent ? [{ text: 'تحذير: القاصرون يتطلبون موافقة ولي الأمر.', fontSize: 9, bold: true, color: '#b45309', margin: [0, 3, 0, 0] }] : []),
          ...(a.needsLabTest ? [{ text: 'تحذير: بعض المكملات تتطلب تحليلًا مخبريًا مسبقًا.', fontSize: 9, bold: true, color: '#b45309', margin: [0, 3, 0, 0] }] : []),
        ],
        margin: [0, 0, 0, 12],
      },

      // التغطية
      {
        stack: [
          sectionHeader('تغطية الاحتياجات من الطعام'),
          {
            layout: 'lightHorizontalLines',
            table: {
              headerRows: 1,
              widths: ['18%', '12%', '18%', '18%', '18%', '16%'],
              body: [
                [headerCell('العجز'), headerCell('التغطية'), headerCell('المجموع'), headerCell('من الطعام'), headerCell('الاحتياج'), headerCell('المغذي')],
                ...coverageRows,
              ],
            },
          },
          { text: 'التغطية أقل من 70% منخفضة · 70-90% تحتاج تحسينًا غذائيًا · 90-110% نطاق مناسب · أكثر من 110% مراجعة الزيادة.', fontSize: 8, color: color.slate, margin: [0, 6, 0, 0] },
        ],
        margin: [0, 0, 0, 12],
      },

      // البروتين
      ...(a.proteinGap
        ? [
            {
              stack: [
                sectionHeader('فجوة البروتين (الغذاء أولًا)'),
                {
                  layout: 'lightHorizontalLines',
                  table: {
                    headerRows: 1,
                    widths: ['25%', '25%', '25%', '25%'],
                    body: [
                      [headerCell('حصص مسحوق تقديرية'), headerCell('العجز'), headerCell('من الطعام'), headerCell('الاحتياج')],
                      [
                        cell(String(a.proteinGap.powderScoops)),
                        cell(`${a.proteinGap.deficitG} جم`),
                        cell(`${a.proteinGap.fromFoodG} جم`),
                        cell(`${a.proteinGap.requirementG} جم`),
                      ],
                    ],
                  },
                },
                ...(a.proteinGap.foodOptions.length > 0
                  ? [
                      { text: 'خيارات لتغطية العجز غذائيًا أولًا:', fontSize: 9.5, bold: true, color: color.ocean, margin: [0, 8, 0, 4] },
                      ...a.proteinGap.foodOptions.map((f) => bullet(`${f.nameAr} — ~${f.grams} جم (${f.proteinG} جم بروتين، ${f.calories} سعرة)`)),
                    ]
                  : []),
                { text: a.proteinGap.note, fontSize: 8.5, color: color.slate, margin: [0, 6, 0, 0] },
              ],
              margin: [0, 0, 0, 12],
            },
          ]
        : []),

      // الترطيب
      ...(a.hydration
        ? [
            {
              stack: [
                sectionHeader('الترطيب والكهرل'),
                {
                  layout: 'lightHorizontalLines',
                  table: {
                    headerRows: 1,
                    widths: ['25%', '25%', '25%', '25%'],
                    body: [
                      [headerCell('كهرل موصى'), headerCell('سوائل بعد'), headerCell('سوائل أثناء'), headerCell('معدل التعرق')],
                      [
                        cell(a.hydration.electrolytesRecommended ? 'نعم' : 'لا'),
                        cell(`${a.hydration.fluidsAfterMl} مل`),
                        cell(`${a.hydration.fluidsDuringMl} مل`),
                        cell(`${a.hydration.sweatRateLh} ل/س`),
                      ],
                    ],
                  },
                },
                ...a.hydration.warnings.map((w) => bullet(w)),
              ],
              margin: [0, 0, 0, 12],
            },
          ]
        : []),

      // التوصيات
      {
        stack: [
          sectionHeader('توصيات المكملات المفحوصة'),
          {
            layout: 'lightHorizontalLines',
            table: {
              headerRows: 1,
              widths: ['32%', '18%', '12%', '8%', '14%', '16%'],
              body: [
                [headerCell('ملاحظة'), headerCell('التوقيت'), headerCell('الجرعة'), headerCell('الأدلة'), headerCell('الحالة'), headerCell('المكمل')],
                ...recommendationRows,
              ],
            },
          },
          { text: 'جميع الجرعات تقديرية استرشادية وتُعتمد من المختص قبل الاستخدام.', fontSize: 8, bold: true, color: color.gold, margin: [0, 6, 0, 0] },
        ],
        margin: [0, 0, 0, 12],
      },

      // الأهلية
      {
        stack: [
          sectionHeader('فحص الأهلية والسلامة'),
          ...a.eligibility.map((e) => bullet(`${e.nameAr} — ${e.verdict}: ${e.reasons.join(' · ')}`)),
        ],
        margin: [0, 0, 0, 12],
      },

      // الجدول
      ...(a.schedule.length > 0
        ? [
            {
              stack: [
                sectionHeader('الجدول المقترح'),
                {
                  layout: 'lightHorizontalLines',
                  table: {
                    headerRows: 1,
                    widths: ['40%', '12%', '14%', '22%', '12%'],
                    body: [
                      [headerCell('السبب'), headerCell('مع الطعام'), headerCell('الجرعة'), headerCell('العنصر'), headerCell('الوقت')],
                      ...scheduleRows,
                    ],
                  },
                },
                ...(a.schedule.some((s) => s.onCompetitionDay)
                  ? [{ text: 'تحذير: لا تُجرَّب مكملات جديدة يوم البطولة.', fontSize: 8.5, bold: true, color: '#b91c1c', margin: [0, 6, 0, 0] }]
                  : []),
              ],
              margin: [0, 0, 0, 12],
            },
          ]
        : []),

      // بدائل غذائية
      ...(a.foodAlternatives.length > 0
        ? [
            {
              stack: [
                sectionHeader('بدائل غذائية للعناصر الناقصة'),
                ...a.foodAlternatives.flatMap((alt) => [
                  { text: alt.nameAr, fontSize: 9.5, bold: true, color: color.ocean, margin: [0, 4, 0, 2] },
                  ...alt.options.map((o) => bullet(`${o.nameAr} — ~${o.grams} جم (${o.proteinG} جم بروتين، ${o.calories} سعرة)`)),
                ]),
              ],
              margin: [0, 0, 0, 12],
            },
          ]
        : []),

      // إخلاء المسؤولية
      {
        stack: [
          { text: 'تنبيه وإخلاء مسؤولية', fontSize: 10, bold: true, color: color.ocean, margin: [0, 0, 0, 4] },
          { text: SUPPLEMENT_DISCLAIMER, fontSize: 8.5, color: color.slate, lineHeight: 1.6 },
        ],
        margin: [0, 8, 0, 10],
      },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: color.line }], margin: [0, 4, 0, 12] } as object,
      {
        columns: [
          { width: '50%', stack: [{ text: 'إعداد وإشراف', fontSize: 9, bold: true, color: color.ocean }, { text: 'د. وليد عبد الرحمن عبد الظاهر', fontSize: 11, bold: true, color: color.ocean }, { text: 'Top Academy — Smart Swimmer Nutrition', fontSize: 8, color: color.slate }] },
        ],
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
