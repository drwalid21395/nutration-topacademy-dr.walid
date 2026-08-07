/**
 * محرك الأهلية للمكملات — يُشغَّل قبل أي حساب أو توصية.
 * يفحص العمر، الحالة الصحية، الأدوية، التكرار بين المكملات،
 * قرب البطولة، قوانين مكافحة المنشطات، وموافقة ولي الأمر للقاصرين.
 */
import type { EligibilityContext, EligibilityResult } from './types';

export interface EligibilityProfile {
  key: string;
  nameAr: string;
  category: string;
  minAge: number;
  suitableForMinors: boolean;
  needsLabTest: boolean;
  needsMedicalSupervision: boolean;
  needsRx: boolean;
  dopingRisk: string;
  linkedToWeight?: boolean;
  linkedToCompetition: boolean;
  contraindicationsAr?: string | null;
  medicationInteractionsAr?: string | null;
  supplementInteractionsAr?: string | null;
  targetNutrient: string;
  evidenceStrength: string;
  evidenceWeak?: boolean;
}

function textMatches(text: string | null | undefined, needles: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

export function checkAgeEligibility(
  profile: EligibilityProfile,
  ctx: EligibilityContext
): { ok: boolean; verdict: string; reason: string; needsGuardian: boolean } {
  // القاصرون
  if (ctx.isMinor) {
    if (profile.key === 'caffeine' || profile.key === 'beta-alanine' || profile.category === 'خسارة وزن' || profile.category === 'حارق دهون') {
      return { ok: false, verdict: 'age-blocked', reason: 'ممنوع للقاصرين: كافيين/منبهات/حوارق دهون دون مراجعة مختص.', needsGuardian: false };
    }
    if (!profile.suitableForMinors) {
      return { ok: false, verdict: 'age-blocked', reason: 'غير مدعوم للقاصرين إلا بإشراف طبي صريح.', needsGuardian: true };
    }
    if (!ctx.guardianConsent) {
      return { ok: false, verdict: 'minor-consent', reason: 'يتطلب موافقة ولي الأمر قبل أي تقييم.', needsGuardian: true };
    }
  }
  if (profile.minAge > 0 && ctx.age != null && ctx.age < profile.minAge) {
    return { ok: false, verdict: 'age-blocked', reason: `الحد الأدنى للعمر ${profile.minAge} عامًا.`, needsGuardian: ctx.isMinor };
  }
  return { ok: true, verdict: 'suitable', reason: 'العمر مناسب.', needsGuardian: false };
}

export function checkMedicalContraindications(
  profile: EligibilityProfile,
  ctx: EligibilityContext
): { ok: boolean; verdict: string; reason: string; needsDoctor: boolean } {
  const conditions = ctx.chronicConditions;
  if (textMatches(conditions, ['كلى', 'كلوي', 'kidney', 'renal'])) {
    if (['creatine', 'protein', 'magnesium', 'electrolytes'].includes(profile.key)) {
      return { ok: false, verdict: 'health-blocked', reason: 'يتعارض مع أمراض الكلى — يجب مراجعة الطبيب.', needsDoctor: true };
    }
  }
  if (textMatches(conditions, ['قلب', 'قلبية', 'cardiac', 'heart', 'ضغط', 'hypertension'])) {
    if (['caffeine', 'electrolytes', 'beta-alanine'].includes(profile.key)) {
      return { ok: false, verdict: 'health-blocked', reason: 'يتعارض مع أمراض القلب أو ارتفاع الضغط.', needsDoctor: true };
    }
  }
  if (textMatches(conditions, ['كبد', 'كبدي', 'liver', 'hepatic'])) {
    if (['beta-alanine'].includes(profile.key)) {
      return { ok: false, verdict: 'health-blocked', reason: 'يتعارض مع أمراض الكبد.', needsDoctor: true };
    }
  }
  if (ctx.pregnancyStatus && ctx.pregnancyStatus !== 'none') {
    if (['caffeine', 'beta-alanine', 'creatine', 'bicarbonate'].includes(profile.key)) {
      return { ok: false, verdict: 'health-blocked', reason: 'غير موصى به أثناء الحمل/الرضاعة دون إشراف طبي.', needsDoctor: true };
    }
  }
  if (ctx.hasEatingDisorderHistory) {
    if (profile.linkedToWeight || profile.category === 'خسارة وزن') {
      return { ok: false, verdict: 'health-blocked', reason: 'تاريخ اضطرابات الأكل — لا تُقترح مكملات مرتبطة بالوزن.', needsDoctor: true };
    }
  }
  if (profile.needsRx) {
    return { ok: false, verdict: 'needs-doctor', reason: 'يتطلب وصفة أو إشرافًا طبيًا إلزاميًا.', needsDoctor: true };
  }
  if (textMatches(ctx.allergies, ['مكسرات', 'nuts']) && profile.key === 'carnitine') {
    return { ok: false, verdict: 'health-blocked', reason: 'حساسية ذات صلة.', needsDoctor: true };
  }
  if (profile.needsMedicalSupervision) {
    return { ok: true, verdict: 'needs-doctor', reason: 'الاستخدام يتطلب مراجعة طبيب أو اختصاصي تغذية رياضية.', needsDoctor: true };
  }
  return { ok: true, verdict: 'suitable', reason: 'لا موانع صحية واضحة في الملف.', needsDoctor: false };
}

export function checkMedicationInteractions(
  profile: EligibilityProfile,
  ctx: EligibilityContext
): { ok: boolean; verdict: string; reason: string; needsDoctor: boolean } {
  if (!ctx.medications) return { ok: true, verdict: 'suitable', reason: 'لا أدوية مسجلة.', needsDoctor: false };
  const meds = ctx.medications.toLowerCase();
  const blockers: [string[], string][] = [
    [['مميع', 'وارفارين', 'warfarin', 'aspirin', 'أسبرين'], 'omega3'],
    [['ضغط', 'مدر', 'diuretic', 'furosemide', 'hypertension'], 'electrolytes'],
    [['قلب', 'قلبية', 'arrhythmia', 'cardiac'], 'caffeine'],
    [['مضاد حيوي', 'antibiotic', 'tetracycline'], 'magnesium'],
    [['thyroid', 'غدة درقية', 'levothyroxine'], 'iron'],
    [['سكري', 'diabetes', 'metformin'], 'creatine'],
  ];
  for (const [needles, key] of blockers) {
    if (key === profile.key && textMatches(meds, needles)) {
      return {
        ok: false,
        verdict: 'drug-interaction',
        reason: `تداخل محتمل مع دواء (${
          profile.medicationInteractionsAr ?? 'يجب مراجعة الطبيب'
        }).`,
        needsDoctor: true,
      };
    }
  }
  return { ok: true, verdict: 'suitable', reason: 'لا تداخل دوائي معروف حسب البيانات المدخلة.', needsDoctor: false };
}

export function checkDuplicateIngredients(
  ingredientName: string,
  ctx: EligibilityContext,
  upperLimit?: number | null
): { duplicate: boolean; totalAmount: number; unit: string; status: 'ok' | 'approaching' | 'exceeded'; message: string } {
  const matches = ctx.currentIngredients.filter(
    (i) => i.name.toLowerCase().includes(ingredientName.toLowerCase()) || ingredientName.toLowerCase().includes(i.name.toLowerCase())
  );
  const totalAmount = matches.reduce((a, i) => a + (i.amount || 0), 0);
  const unit = matches[0]?.unit ?? 'g';
  if (!upperLimit || upperLimit <= 0) {
    return {
      duplicate: matches.length > 0,
      totalAmount,
      unit,
      status: 'ok',
      message: matches.length > 0 ? `يوجد مكوّن مكرر في ${matches.length} منتج (${totalAmount} ${unit}).` : 'لا تكرار.',
    };
  }
  if (totalAmount >= upperLimit) {
    return { duplicate: true, totalAmount, unit, status: 'exceeded', message: `تجاوز الحد الأعلى للـ ${ingredientName}: ${totalAmount} ${unit} (الحد ${upperLimit} ${unit}).` };
  }
  if (totalAmount >= upperLimit * 0.9) {
    return { duplicate: true, totalAmount, unit, status: 'approaching', message: `اقتراب من الحد الأعلى للـ ${ingredientName}: ${totalAmount} ${unit}.` };
  }
  return { duplicate: true, totalAmount, unit, status: 'ok', message: `إجمالي ${ingredientName} الحالي ${totalAmount} ${unit}.` };
}

export function checkCompetitionSafety(
  profile: EligibilityProfile,
  ctx: EligibilityContext
): { ok: boolean; verdict: string; reason: string } {
  if (ctx.competitionMode && profile.linkedToCompetition) {
    if (ctx.competitionDaysAway != null && ctx.competitionDaysAway <= 7) {
      return { ok: false, verdict: 'competition-blocked', reason: 'قرب البطولة (أقل من 7 أيام): لا تُجرَّب مكملات جديدة — استخدم ما اختُبر خلال التدريب فقط.' };
    }
  }
  if (profile.dopingRisk === 'prohibited') {
    return { ok: false, verdict: 'doping-blocked', reason: 'مدرج ضمن المواد المحظورة وفق لوائح مكافحة المنشطات.' };
  }
  if (profile.dopingRisk === 'high' || profile.dopingRisk === 'medium') {
    return { ok: false, verdict: 'high-risk', reason: 'خطر تلوث محتمل — يُطلب منتج مختبر من جهة مستقلة وإدخال اسم المنتج الكامل ورقم التشغيلة.' };
  }
  return { ok: true, verdict: 'suitable', reason: 'آمن بالنسبة لقرب البطولة ومكافحة المنشطات حسب المتاح.' };
}

/** تشغيل محرك الأهلية الكامل لمكمل واحد */
export function runEligibility(profile: EligibilityProfile, ctx: EligibilityContext): EligibilityResult {
  const flags = { needsGuardian: false, needsLab: false, needsDoctor: false, competitionRestricted: false, dopingRestricted: false };

  // دليل علمي ضعيف أو مكمل عالي الخطورة
  if (profile.evidenceWeak || profile.evidenceStrength === 'D') {
    flags.dopingRestricted = false;
    return {
      ok: false,
      verdict: 'high-risk',
      reasons: ['دليل علمي ضعيف أو غير كافٍ لدعم التوصية.'],
      flags,
    };
  }

  const reasons: string[] = [];

  // الغذاء أولًا: لا حاجة إذا لم يكن هناك عجز حقيقي
  if (!ctx.dietaryDeficitForTarget) {
    return {
      ok: false,
      verdict: 'food-sufficient',
      reasons: ['لا يوجد عجز واضح في الاحتياج المستهدف حاليًا — الغذاء الطبيعي أساس التوصية.'],
      flags,
    };
  }

  const age = checkAgeEligibility(profile, ctx);
  flags.needsGuardian = age.needsGuardian;
  if (!age.ok) return { ok: false, verdict: age.verdict, reasons: [age.reason], flags };

  const health = checkMedicalContraindications(profile, ctx);
  flags.needsDoctor = health.needsDoctor;
  if (!health.ok) return { ok: false, verdict: health.verdict, reasons: [health.reason], flags };

  const meds = checkMedicationInteractions(profile, ctx);
  flags.needsDoctor = flags.needsDoctor || meds.needsDoctor;
  if (!meds.ok) return { ok: false, verdict: meds.verdict, reasons: [meds.reason], flags };

  const comp = checkCompetitionSafety(profile, ctx);
  flags.competitionRestricted = !comp.ok;
  flags.dopingRestricted = profile.dopingRisk === 'prohibited';
  if (!comp.ok) return { ok: false, verdict: comp.verdict, reasons: [comp.reason], flags };

  // تحليل مخبري مطلوب
  if (profile.needsLabTest && !ctx.hasRelevantLab) {
    flags.needsLab = true;
    return { ok: false, verdict: 'needs-lab', reasons: ['يتطلب تحليلًا طبيًا (دم/فيتامينات) قبل التقييم — لا تُقترح جرعة دون تحليل.'], flags };
  }

  // إشراف طبي
  if (profile.needsMedicalSupervision) {
    flags.needsDoctor = true;
    reasons.push(profile.medicationInteractionsAr && profile.key === 'creatine' ? 'إشراف طبي مطلوب للاستخدام.' : 'إشراف طبي مطلوب للاستخدام.');
    return { ok: true, verdict: 'needs-doctor', reasons, flags };
  }

  reasons.push(age.reason, health.reason, meds.reason, comp.reason);
  return { ok: true, verdict: 'suitable', reasons, flags };
}
