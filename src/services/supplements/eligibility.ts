/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/services/supplements/eligibility.ts

وظيفة الملف:
"محرك الأهلية للمكملات" — يُشغَّل قبل أي حساب أو توصية. يفحص:
العمر، الحالة الصحية، الأدوية، التكرار بين المكملات، قرب البطولة،
قوانين مكافحة المنشطات، وموافقة ولي الأمر للقاصرين.

لماذا نحتاجه؟
حتى لا نقترح مكملًا غير مناسب لعمر السباح أو حالته الصحية أو
قريبًا من بطولته — فالأمان يأتي قبل التوصية.

متى يعمل؟
داخل generateSupplementAssessment (assessment.ts) لكل مكمل "مستجيب"
عبر runEligibility.

من يستدعي هذا الملف؟
- supplements/assessment.ts → runEligibility + EligibilityProfile.

الملفات التي يتعامل معها:
- ./types → EligibilityContext, EligibilityResult (الأنواع).
- ./profiles → بيانات المكمل التي تُفحص (تُمرَّر من الملف المستدعي).

ترتيب العمل:
سياق الأهلية (EligibilityContext) + بيانات المكمل ↓
فحوصات متتالية: دليل علمي ← عجز غذائي ← عمر ← موانع صحية ←
تداخل دوائي ← أمان البطولة/المنشطات ← تحليل مخبري ← إشراف طبي ↓
إصدار verdict + أسباب + أعلام (flags)

ملاحظة مهمة:
النتائج استرشادية أمانية وليست وصفات — تُرجع أسبابًا واضحة
يقرأها المستخدم والمختص قبل أي قرار.
==================================================
*/

/**
 * محرك الأهلية للمكملات — يُشغَّل قبل أي حساب أو توصية.
 * يفحص العمر، الحالة الصحية، الأدوية، التكرار بين المكملات،
 * قرب البطولة، قوانين مكافحة المنشطات، وموافقة ولي الأمر للقاصرين.
 */
// ========================================
// 1. الاستيرادات
// ========================================

// الأنواع المشتركة بين وحدات المكملات (استيراد أنواع فقط).
import type { EligibilityContext, EligibilityResult } from './types';

// ========================================
// 2. الأنواع
// ========================================

// ملف بيانات مكمل واحد — كل حقوله تُفحص في محرك الأهلية.
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

// ========================================
// 3. أدوات مساعدة
// ========================================

/*
-----------------------------------------
الدالة: textMatches
-----------------------------------------
وظيفتها: فحص نص حر (مثل الحالات الصحية أو الأدوية) بحثًا عن أي
كلمة من قائمة معينة، بأسلوب غير حساس لحالة الحروف.
Input: نص قد يكون null/undefined + قائمة كلمات.
Processing: تحويل النص لأحرف صغيرة ثم البحث عن كل كلمة.
Output: true إن وُجدت أي كلمة من القائمة.
-----------------------------------------
*/
function textMatches(text: string | null | undefined, needles: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

// ========================================
// 4. دوال الفحص
// ========================================

/*
-----------------------------------------
الدالة: checkAgeEligibility
-----------------------------------------
وظيفتها: فحص عمر السباح (وهل هو قاصر) مقابل شروط المكمل.
Input: بيانات المكمل + سياق الأهلية.
Processing: إذا كان قاصرًا: منع الممنوعات (كافيين/منبهات/حوارق دهون)؛
  وفي غيرها: اشتراط صلاحية المكمل للقاصرين ثم موافقة ولي الأمر؛
  وأخيرًا مقارنة العمر بالحد الأدنى إن وُجد.
Output: ok / verdict / reason / هل يحتاج موافقة ولي الأمر؟
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: checkMedicalContraindications
-----------------------------------------
وظيفتها: البحث عن موانع صحية: أمراض الكلى/القلب/الكبد، الحمل،
تاريخ اضطرابات الأكل، حساسية ذات صلة، والمكملات التي تتطلب وصفة.
Input: بيانات المكمل + سياق الأهلية.
Processing: مطابقة الكلمات المفتاحية مع فئات المكملات
  (كرياتين/بروتين/كهارل مع الكلى، كافيين/كهارل مع القلب...).
Output: ok / verdict / reason / هل يحتاج طبيبًا؟
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: checkMedicationInteractions
-----------------------------------------
وظيفتها: كشف التداخل المحتمل بين المكمل والأدوية المسجلة.
Input: بيانات المكمل + سياق الأهلية (حقل الأدوية).
Processing: جدول أدوية مع مكملات متعارضة؛ لكل صف، إن كان المكمل
  الحالي هو المستهدف ونص الأدوية يحتوي كلمة من القائمة → تداخل.
Output: ok / verdict / reason / هل يحتاج طبيبًا؟
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: checkDuplicateIngredients
-----------------------------------------
وظيفتها: فحص تكرار مكوّن في عدة منتجات (منتجات السباح الحالية)
مع حساب إجمالي كميته ومقارنته بالحد الأعلى إن وُجد.
Input: اسم المكوّن + سياق الأهلية + حد أعلى اختياري.
Processing: تجميع المطابقات بالاسم، جمع الكميات، ومقارنة الإجمالي
  بالحد (تجاوز / اقتراب / طبيعي).
Output: هل يوجد تكرار + الكمية الإجمالية + الوحدة + الحالة + رسالة.
-----------------------------------------
*/
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

/*
-----------------------------------------
الدالة: checkCompetitionSafety
-----------------------------------------
وظيفتها: أمان المكمل قرب البطولة ووفق لوائح مكافحة المنشطات.
Input: بيانات المكمل + سياق الأهلية.
Processing: قرب بطولة (أقل من 7 أيام) + مكمل مرتبط بالمنافسة ← منع
  تجريب مكملات جديدة؛ dopingRisk محظور ← منع؛ خطر تلوث عالٍ/متوسط ←
  طلب منتج مختبر من جهة مستقلة.
Output: ok / verdict / reason.
-----------------------------------------
*/
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

// ========================================
// 5. الدالة الرئيسية (تشغيل المحرك)
// ========================================

/*
-----------------------------------------
الدالة: runEligibility
-----------------------------------------
وظيفتها: تشغيل محرك الأهلية الكامل لمكمل واحد بالترتيب.
Input: بيانات المكمل + سياق الأهلية.
Processing:
  1. دليل علمي ضعيف ← high-risk.
  2. لا عجز غذائي حقيقي ← food-sufficient (الغذاء أولًا).
  3. فحوصات متتالية (عمر، موانع صحية، تداخل دوائي، أمان البطولة).
  4. تحليل مخبري مطلوب وليس متوفرًا ← needs-lab.
  5. إشراف طبي مطلوب ← needs-doctor (مسموح مع الإشراف).
Output: EligibilityResult (verdict + reasons + flags).
يُستدعى من: assessment.ts لكل مكمل مستجيب.
-----------------------------------------
*/
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
