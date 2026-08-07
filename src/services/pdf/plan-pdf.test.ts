import { describe, it, expect } from 'vitest';
import { toRtl, applyRtlNode } from './plan-pdf';

describe('toRtl', () => {
  it('يعكس ترتيب كلمات السطر العربي', () => {
    expect(toRtl('إصدار الخطة')).toBe('الخطة إصدار');
    expect(toRtl('السباح: أحمد محمد السباح')).toBe('السباح محمد أحمد السباح:');
  });

  it('يبقي السطر اللاتيني/الرقمي كما هو', () => {
    expect(toRtl('TOP ACADEMY')).toBe('TOP ACADEMY');
    expect(toRtl('Smart Swimmer Nutrition')).toBe('Smart Swimmer Nutrition');
  });

  it('يعالج كل سطر على حدة', () => {
    expect(toRtl('الخطة الغذائية\nTOP ACADEMY')).toBe('الغذائية الخطة\nTOP ACADEMY');
  });

  it('يضع الرقم بعد الكلمة في الترتيب البصري', () => {
    expect(toRtl('4300 سعرة')).toBe('سعرة 4300');
    expect(toRtl('140 جم')).toBe('جم 140');
  });

  it('النص الفارغ يبقى كما هو', () => {
    expect(toRtl('')).toBe('');
    expect(toRtl('123')).toBe('123');
  });
});

describe('applyRtlNode', () => {
  it('يعدّل النصوص العربية في شجرة المستند ويعكسها', () => {
    const node: Record<string, unknown> = {
      columns: [
        { stack: [{ text: 'إصدار الخطة' }] },
        { table: { body: [[{ text: 'اليوم 1' }], [{ text: 'المكونات' }]] } },
      ],
      canvas: [{ type: 'line', x1: 0, y1: 0 }],
    };
    applyRtlNode(node);
    expect((node.columns as unknown[])[0]).toEqual({ stack: [{ text: 'الخطة إصدار' }] });
    const body = ((node.columns as { table: { body: unknown[][] } }[])[1].table).body;
    expect(body[0][0]).toEqual({ text: '1 اليوم' });
    expect(body[1][0]).toEqual({ text: 'المكونات' });
  });

  it('لا يلمس النصوص اللاتينية أو الصور', () => {
    const node: Record<string, unknown> = {
      text: 'TOP ACADEMY',
      image: 'data:image/png;base64,xxx',
    };
    applyRtlNode(node);
    expect(node.text).toBe('TOP ACADEMY');
    expect(node.image).toBe('data:image/png;base64,xxx');
  });
});
