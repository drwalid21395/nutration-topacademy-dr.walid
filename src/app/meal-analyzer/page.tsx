import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/app-shell';
import { MealAnalyzer } from '@/components/analyzer/meal-analyzer';
import { activeProviderName } from '@/services/ai';
import { Badge, Alert } from '@/components/ui';
import { MOCK_WARNING } from '@/services/ai/mock';

export const metadata = { title: 'محلل الوجبات الذكي' };

export default async function MealAnalyzerPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true, proteinG: true, carbsG: true, fatG: true },
  });

  const provider = activeProviderName();

  return (
    <AppShell user={user}>
      {provider === 'mock' && (
        <div className="mb-4">
          <Alert variant="warning" title="التشغيل بوضع المحاكاة">
            {MOCK_WARNING} لا تُستخدم النتائج كأساس لاتخاذ قرارات غذائية.
          </Alert>
        </div>
      )}
      <div className="mb-5 flex items-center gap-2">
        <Badge color={provider === 'mock' ? 'slate' : 'green'}>
          مزود التحليل: {provider === 'mock' ? 'تقدير محلي (تجريبي)' : provider === 'openai' ? 'OpenAI Vision' : 'Gemini Vision'}
        </Badge>
      </div>
      <MealAnalyzer targets={targets} />
    </AppShell>
  );
}
