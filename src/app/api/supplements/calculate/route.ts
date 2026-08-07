import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateSupplementAssessment } from '@/services/supplements/assessment';
import type { SupplementAssessmentInput } from '@/services/supplements/types';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  let input: SupplementAssessmentInput;
  try {
    input = (await req.json()) as SupplementAssessmentInput;
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  try {
    const result = generateSupplementAssessment(input);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('Supplement assessment error:', e);
    return NextResponse.json({ error: 'تعذر إكمال التقييم، تأكد من المدخلات' }, { status: 422 });
  }
}
