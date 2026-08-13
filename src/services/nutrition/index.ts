/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/nutrition/index.ts

وظيفة الملف:
"خدمة حساب الاحتياجات الغذائية" — الواجهة الموحدة التي
تجمع ثلاثة أجزاء:
1. المعادلات (calculations) → حساب BMR/TDEE/سعرات/ماء.
2. التوصيات (recommendations) → نصائح حسب الهدف والتدريب.
3. التنبيهات الطبية (هذا الملف) → تحذيرات أمان غير علاجية.

لماذا نحتاجه؟
هذا هو "العقل" العلمي للموقع. صفحة الحاسبة وواجهة API
(api/calculator) تستدعي دالة واحدة: summarizeNutrition.

لماذا نقسم الملفات؟
الفصل بين الحساب والتوصيات يجعل تعديل المعادلات لاحقًا
أسهل دون المساس بالأجزاء الأخرى.

متى تعمل؟
عند استدعاء summarizeNutrition من api/calculator/route.ts
(وقد تُستخدم من صفحات أخرى).

قاعدة أمان مهمة:
هذه الخدمة لا تصدر "وصفات علاجية" — بل تنبيهات (alerts)
تنبه المستخدم لمراجعة الطبيب في الحالات الخاصة
(قاصر، BMI غير طبيعي، حمل، أمراض مزمنة...).
==================================================
*/

/**
 * خدمة حساب الاحتياجات الغذائية — واجهة موحدة للواجهة ووحدات API.
 * الفصل بين الحساب (calculations) والتوصيات (recommendations) يسهّل تحديث المعادلات.
 */

// ========================================
// 1. الاستيرادات
// ========================================

// calculateNutrition: المعادلات نفسها. calcBMI: حساب مؤشر كتلة الجسم.
import { calculateNutrition, calcBMI } from './calculations';
// buildRecommendations: توليد النصائح من النتيجة.
import { buildRecommendations } from './recommendations';
// أنواع مشتركة من src/types.
import type { NutritionResult, SwimmerFormData } from '@/types';

// نعيد تصدير calcBMI لمن يحتاجه مباشرة.
export { calcBMI } from './calculations';

// ========================================
// 2. الأنواع
// ========================================

// NutritionSummary: شكل النتيجة النهائية التي ترجعها الخدمة.
export interface NutritionSummary {
  result: NutritionResult; // كل الأرقام (سعرات، بروتين، ماء...)
  recommendations: Record<string, string>; // نصائح نصية
  alerts: { type: 'info' | 'warning' | 'danger'; message: string }[]; // تنبيهات
}

// ========================================
// 3. التنبيهات الطبية (أمان)
// ========================================

/*
-----------------------------------------
الدالة: buildMedicalAlerts
-----------------------------------------
وظيفتها: فحص المدخلات بحثًا عن حالات حساسة وإصدار تنبيهات
واضحة غير علاجية.

متى تعمل؟ داخل summarizeNutrition.

تنبيهات:
- قاصر (isMinor أو العمر أقل من 18) → تحذير بإشراف ولي الأمر.
- BMI خارج 17-32 → تنبيه خطير بمراجعة مختص.
- أمراض مزمنة → تنبيه خطير.
- حساسية → تحذير بمطابقة البدائل.
- حمل/رضاعة → تنبيه خطير.

Input: بيانات أساسية (عمر، جنس، وزن، طول، حالات...).
Output: قائمة تنبيهات.
-----------------------------------------
*/
/** يفحص مدخلات الخطر ويبني تنبيهات طبية واضحة غير علاجية */
export function buildMedicalAlerts(input: {
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  chronicConditions?: string;
  allergies?: string;
  isMinor?: boolean;
  pregnancyStatus?: string;
}): NutritionSummary['alerts'] {
  const alerts: NutritionSummary['alerts'] = [];
  // نحسب BMI أولًا لنستخدمه في الفحص.
  const { bmi } = calcBMI(input.weightKg, input.heightCm);

  // تنبيه: المستخدم قاصر.
  if (input.isMinor || input.age < 18) {
    alerts.push({
      type: 'warning',
      message:
        'هذا السباح قاصر. خطط التغذية للقاصرين إرشادية فقط، ويجب أن تكون تحت إشراف ولي الأمر واختصاصي تغذية رياضية معتمد، مع مراعاة متطلبات النمو.',
    });
  }

  // تنبيه: BMI خارج النطاق المعتاد للسباحين.
  if (bmi < 17 || bmi > 32) {
    alerts.push({
      type: 'danger',
      message:
        `مؤشر كتلة الجسم (${bmi}) خارج النطاق المعتاد للسباحين. لا تقدّم أي خطة خفض أو زيادة حادة. يُرجى مراجعة طبيب أو اختصاصي تغذية لتقييم الحالة.`,
    });
  }

  // تنبيه: أمراض مزمنة مسجلة.
  if (input.chronicConditions) {
    alerts.push({
      type: 'danger',
      message:
        'تم تسجيل حالة صحية مزمنة. لا يقدم النظام توصيات علاجية أو جرعات. الخطة إرشادية فقط وتتطلب متابعة الطبيب المعالج واختصاصي التغذية.',
    });
  }

  // تنبيه: حساسية غذائية.
  if (input.allergies) {
    alerts.push({
      type: 'warning',
      message:
        'تم تسجيل حساسية غذائية. تأكد من مطابقة جميع البدائل والوجبات لتجنّب مسببات الحساسية المسجلة.',
    });
  }

  // تنبيه: حمل أو رضاعة.
  if (input.pregnancyStatus && input.pregnancyStatus !== 'none') {
    alerts.push({
      type: 'danger',
      message:
        'خلال الحمل أو الرضاعة لا تُستخدم خطط الحمية أو نقص السعرات إلا تحت إشراف طبي كامل.',
    });
  }

  return alerts;
}

// ========================================
// 4. الدالة الرئيسية (التجميع)
// ========================================

/*
-----------------------------------------
الدالة: summarizeNutrition
-----------------------------------------
وظيفتها: تجميع النتيجة النهائية من الأجزاء الثلاثة.
Input: بيانات السباح (بأي حقل متاح).
Processing:
  1. calculateNutrition → الأرقام.
  2. buildRecommendations → النصائح.
  3. buildMedicalAlerts → التنبيهات.
Output: NutritionSummary.
يتم استدعاؤها من: src/app/api/calculator/route.ts
-----------------------------------------
*/
export function summarizeNutrition(input: {
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  goal?: string;
  swimmerLevel?: string;
  swimSessionsPerWeek?: number;
  swimMinutesPerSession?: number;
  trainingIntensity?: string;
  gymSessionsPerWeek?: number;
  gymMinutesPerSession?: number;
  gymType?: string;
  dailyActivityLevel?: string;
  preferredMealsPerDay?: number;
  isMinor?: boolean;
  hasDoubleTraining?: boolean;
  nextCompetitionDate?: Date | null;
  chronicConditions?: string;
  allergies?: string;
  pregnancyStatus?: string;
}): NutritionSummary {
  // الخطوة 1: حساب الأرقام (المعادلات العلمية).
  const result = calculateNutrition(input);
  // الخطوة 2: بناء التوصيات حسب الهدف والتدريب.
  const recommendations = buildRecommendations(result, {
    goal: input.goal,
    hasDoubleTraining: input.hasDoubleTraining,
    nextCompetitionDate: input.nextCompetitionDate,
    swimMinutesPerSession: input.swimMinutesPerSession,
  });
  // الخطوة 3: بناء التنبيهات الطبية.
  const alerts = buildMedicalAlerts(input);

  // الخطوة 4: تجميع الكل في نتيجة واحدة.
  return { result, recommendations, alerts };
}
