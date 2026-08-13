/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/meal-analyzer/page.tsx

وظيفة الملف:
صفحة "محلل الوجبات الذكي" (المسار /meal-analyzer).
تُجهّز البيانات اللازمة ثم تعرض المكوّن التفاعلي MealAnalyzer.

لماذا نحتاجه؟
هذه الصفحة هي "المحطة الوسطى": تجلب من الخادم أهداف
المستخدم الغذائية (للمقارنة) ثم تسلّمها لمكون التحليل.

نوعها: Server Component (تعمل في الخادم).
لماذا؟ لأنها تحتاج قراءة قاعدة البيانات (أهداف المستخدم)
قبل إرسال الصفحة. المكوّن الداخلي MealAnalyzer هو Client.

ترتيب التنفيذ:
1. getCurrentUser → لو غير مسجل redirect('/login').
2. نجلب آخر أهداف غذائية (سعرات/بروتين/كربوهيدرات/دهون).
3. نعرف مزود التحليل النشط (mock أم حقيقي؟).
4. لو mock → نعرض تحذير "وضع المحاكاة".
5. نعرض MealAnalyzer مع الأهداف.

العلاقة مع الملفات:
- AppShell (القائمة الجانبية).
- MealAnalyzer من components/analyzer.
- activeProviderName من services/ai.
- MOCK_WARNING من services/ai/mock.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect } from 'next/navigation'; // تحويل غير المسجل
import { getCurrentUser } from '@/lib/auth'; // المستخدم الحالي
import { prisma } from '@/lib/prisma'; // قاعدة البيانات
import { AppShell } from '@/components/layout/app-shell'; // الهيكل العام
import { MealAnalyzer } from '@/components/analyzer/meal-analyzer'; // المكوّن التفاعلي
import { activeProviderName } from '@/services/ai'; // اسم مزود التحليل
import { Badge, Alert } from '@/components/ui'; // عناصر واجهة
import { MOCK_WARNING } from '@/services/ai/mock'; // تحذير وضع المحاكاة

// ========================================
// 2. الصفحة
// ========================================

// metadata: عنوان الصفحة.
export const metadata = { title: 'محلل الوجبات الذكي' };

/*
-----------------------------------------
الدالة: MealAnalyzerPage
-----------------------------------------
متى تعمل؟ عند فتح /meal-analyzer (مسجل الدخول).
خطواتها:
1. تحقق من الدخول.
2. تجلب آخر أهداف غذائية للمستخدم.
3. تحدد مزود التحليل النشط.
4. تعرض الصفحة مع تحذير لو mock.
-----------------------------------------
*/
export default async function MealAnalyzerPage() {
  // الخطوة 1: من هو المستخدم؟ لو غير مسجل → صفحة الدخول.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // الخطوة 2: آخر أهداف غذائية محفوظة للمستخدم.
  // findFirst + orderBy createdAt desc: آخر حساب فقط.
  // select: نطلب حقولًا محددة فقط (خفيف على قاعدة البيانات).
  const targets = await prisma.nutritionTargets.findFirst({
    where: { profile: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
    select: { calories: true, proteinG: true, carbsG: true, fatG: true },
  });

  // الخطوة 3: ما هو مزود التحليل الحالي؟ (mock أو openai...)
  const provider = activeProviderName();

  return (
    <AppShell user={user}>
      {/* لو في وضع المحاكاة (mock) → ننبه المستخدم بوضوح
          أن النتائج تقديرية ولا تُستخدم كأساس غذائي. */}
      {provider === 'mock' && (
        <div className="mb-4">
          <Alert variant="warning" title="التشغيل بوضع المحاكاة">
            {MOCK_WARNING} لا تُستخدم النتائج كأساس لاتخاذ قرارات غذائية.
          </Alert>
        </div>
      )}

      {/* شارة توضح المزود الحالي — تتغير ألوانها حسب الحالة. */}
      <div className="mb-5 flex items-center gap-2">
        <Badge color={provider === 'mock' ? 'slate' : 'green'}>
          مزود التحليل: {provider === 'mock' ? 'تقدير محلي (تجريبي)' : provider === 'openai' ? 'OpenAI Vision' : provider === 'groq' ? 'Groq Vision' : 'Gemini Vision'}
        </Badge>
      </div>

      {/* المكوّن التفاعلي — نمرر له الأهداف للمقارنة في النتائج. */}
      <MealAnalyzer targets={targets} />
    </AppShell>
  );
}
