/**
 * خدمة حساب الاحتياجات الغذائية — واجهة موحدة للواجهة ووحدات API.
 * الفصل بين الحساب (calculations) والتوصيات (recommendations) يسهّل تحديث المعادلات.
 */
import { calculateNutrition, calcBMI } from './calculations';
import { buildRecommendations } from './recommendations';
import type { NutritionResult, SwimmerFormData } from '@/types';

export { calcBMI } from './calculations';

export interface NutritionSummary {
  result: NutritionResult;
  recommendations: Record<string, string>;
  alerts: { type: 'info' | 'warning' | 'danger'; message: string }[];
}

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
  const { bmi } = calcBMI(input.weightKg, input.heightCm);

  if (input.isMinor || input.age < 18) {
    alerts.push({
      type: 'warning',
      message:
        'هذا السباح قاصر. خطط التغذية للقاصرين إرشادية فقط، ويجب أن تكون تحت إشراف ولي الأمر واختصاصي تغذية رياضية معتمد، مع مراعاة متطلبات النمو.',
    });
  }

  if (bmi < 17 || bmi > 32) {
    alerts.push({
      type: 'danger',
      message:
        `مؤشر كتلة الجسم (${bmi}) خارج النطاق المعتاد للسباحين. لا تقدّم أي خطة خفض أو زيادة حادة. يُرجى مراجعة طبيب أو اختصاصي تغذية لتقييم الحالة.`,
    });
  }

  if (input.chronicConditions) {
    alerts.push({
      type: 'danger',
      message:
        'تم تسجيل حالة صحية مزمنة. لا يقدم النظام توصيات علاجية أو جرعات. الخطة إرشادية فقط وتتطلب متابعة الطبيب المعالج واختصاصي التغذية.',
    });
  }

  if (input.allergies) {
    alerts.push({
      type: 'warning',
      message:
        'تم تسجيل حساسية غذائية. تأكد من مطابقة جميع البدائل والوجبات لتجنّب مسببات الحساسية المسجلة.',
    });
  }

  if (input.pregnancyStatus && input.pregnancyStatus !== 'none') {
    alerts.push({
      type: 'danger',
      message:
        'خلال الحمل أو الرضاعة لا تُستخدم خطط الحمية أو نقص السعرات إلا تحت إشراف طبي كامل.',
    });
  }

  return alerts;
}

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
  const result = calculateNutrition(input);
  const recommendations = buildRecommendations(result, {
    goal: input.goal,
    hasDoubleTraining: input.hasDoubleTraining,
    nextCompetitionDate: input.nextCompetitionDate,
    swimMinutesPerSession: input.swimMinutesPerSession,
  });
  const alerts = buildMedicalAlerts(input);

  return { result, recommendations, alerts };
}
