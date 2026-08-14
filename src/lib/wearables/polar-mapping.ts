/*
=================================================
شرح الملف للمبتدئ
=================================================

اسم الملف:
src/lib/wearables/polar-mapping.ts

وظيفة الملف:
"قاموس الترجمة" الخاص بـ Polar — يحوّل اسم الرياضة إلى
صيغتنا الموحّدة، ويحوّل مدة Polar (بصيغة HH:MM:SS أو
مللي ثانية) إلى دقائق.

لماذا نحتاجه؟
Polar ترسل اسم النشاط (مثل "SWIMMING") والمدة بصيغة خاصة.
نريد ترجمة هذه اللغة إلى لغة الموقع الموحّدة هنا فقط.

لماذا "نقي" (بدون تبعيات)؟
دوال خالصة: كائن/قيمة تدخل ونتيجة تخرج — سهلة الاختبار
(ملف .test.ts مرافق).

متى يعمل؟
عند مزامنة Polar (في polar.ts) لكل تمرين.

من يستدعيه؟
- src/lib/wearables/polar.ts (جالب Polar).
- src/lib/wearables/polar-mapping.test.ts (الاختبارات).

الملفات التي يتعامل معها:
- لا يستورد من أي ملف — دوال خالصة.

ترتيب العمل:
بيانات Polar ← mapPolarSport / parsePolarDuration ← صيغة موحّدة
=================================================
*/

// ========================================
// 1. تصنيف الرياضة وتحويل المدة
// ========================================

/**
 * تحويلات Polar النقية (بدون تبعيات) — قابلة للاختبار وحدة.
 */

/*
-----------------------------------------
الدالة: mapPolarSport
-----------------------------------------
وظيفتها: تصنيف رياضة Polar إلى صيغتنا الموحّدة.
Input: sport (اسم الرياضة كنص).
Processing: نفحص الاسم بعد تحويله لأحرف كبيرة ونبحث عن كلمات
            (SWIM, RUN, CYCL...). لاحظ أنه لا يعالج YOGA كـ gym
            هنا (يُصنَّف other) بخلاف المزودين الآخرين.
Output: swim / run / cycle / walk / gym / other.
يستدعيها: polar.ts (في mapExercise).
-----------------------------------------
*/
export function mapPolarSport(sport: string): string {
  const s = (sport ?? '').toUpperCase();
  if (s.includes('SWIM')) return 'swim';
  if (s.includes('RUN')) return 'run';
  if (s.includes('CYCL') || s.includes('BIKE') || s.includes('SPIN')) return 'cycle';
  if (s.includes('WALK') || s.includes('HIKE')) return 'walk';
  if (
    s.includes('WEIGHT') ||
    s.includes('GYM') ||
    s.includes('FITNESS') ||
    s.includes('CIRCUIT') ||
    s.includes('TRAINER') ||
    s.includes('CROSSFIT') ||
    s.includes('CORE')
  ) {
    return 'gym';
  }
  return 'other';
}

/*
-----------------------------------------
الدالة: parsePolarDuration
-----------------------------------------
وظيفتها: تحويل مدة Polar إلى دقائق.
Input: duration (نص بصيغة HH:MM:SS أو رقم بالمللي ثانية،
       وقد تكون undefined).
Processing: لو كانت رقمًا → قسمة على 60000 (مللي → دقائق).
            لو كانت نصًا مكوّنًا من 3 أجزاء (ساعة:دقيقة:ثانية)
            → نحولها إلى دقائق. وإلا نحاول تحويل النص لرقم.
Output: الدقائق، أو undefined للقيم غير الصالحة.
يستدعيها: polar.ts (في mapExercise).
-----------------------------------------
*/
/** مدة Polar بصيغة "HH:MM:SS" → دقائق. */
export function parsePolarDuration(duration: string | number | undefined): number | undefined {
  if (duration == null) return undefined;
  if (typeof duration === 'number') return Math.round(duration / 60000);
  const parts = String(duration).split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }
  const n = Number(duration);
  return Number.isNaN(n) ? undefined : Math.round(n / 60000);
}
