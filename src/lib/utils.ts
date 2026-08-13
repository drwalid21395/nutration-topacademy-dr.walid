/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/lib/utils.ts

وظيفة الملف:
مجموعة "دوال مساعدة" صغيرة نستخدمها في كل المشروع:
- دمج أسماء فئات Tailwind (cn).
- حساب العمر.
- تنسيق الأرقام والتواريخ بالعربي.
- دوال صغيرة مثل بداية اليوم.

لماذا نحتاجه؟
في أي مشروع تتكرر أشياء (تنسيق رقم، تاريخ...).
بدلًا من كتابتها في كل صفحة، نكتبها مرة واحدة هنا ونستوردها.

من يستخدمه؟
كل الصفحات والمكونات تقريبًا (مثل formatNumber في لوحة التحكم).

ترتيب التنفيذ:
لا يعمل هذا الملف من تلقاء نفسه — دواله تعمل فقط
عندما تستدعيها صفحة أو مكون آخر.
==================================================
*/

// ========================================
// 1. استيراد المكتبات
// ========================================

// clsx: مكتبة تجمع أسماء الفئات الشرطية (دمج سلاسل).
// tailwind-merge: يزيل التعارض بين فئات Tailwind ويبقي الأحدث.
// كلتاهما ليستا من JavaScript نفسها — مكتبتان خارجيتان مثبتتان في المشروع.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ========================================
// 2. الدوال المساعدة
// ========================================

/*
-----------------------------------------
الدالة: cn
-----------------------------------------
وظيفتها: دمج أسماء فئات Tailwind مع إزالة التعارضات.
Input: قائمة من القيم (سلاسل نصية، شرطية، null...).
Processing: تجميعها + دمجها بذكاء.
Output: سلسلة نصية واحدة جاهزة لـ className.
يتم استدعاؤها من: كل المكونات تقريبًا.
-----------------------------------------
*/
export function cn(...inputs: ClassValue[]) {
  // ...inputs: "Rest Parameter" — تجمع كل القيم المرسلة في قائمة.
  // clsx(inputs): يحولها إلى نص واحد.
  // twMerge(...): يزيل فئات متعارضة (مثال: bg-ocean-600 ثم bg-red-500
  //   يحتفظ بالأخيرة فقط بدل أن يكتبهما معًا).
  return twMerge(clsx(inputs));
}

/*
-----------------------------------------
الدالة: calculateAge
-----------------------------------------
وظيفتها: حساب العمر الكامل من تاريخ الميلاد.
Input: birthDate (تاريخ الميلاد).
Output: رقم العمر (أكبر من أو يساوي صفر).
-----------------------------------------
*/
/** حساب العمر من تاريخ الميلاد */
export function calculateAge(birthDate: Date): number {
  const now = new Date(); // التاريخ الحالي
  let age = now.getFullYear() - birthDate.getFullYear(); // فرق السنوات
  const m = now.getMonth() - birthDate.getMonth(); // فرق الشهور
  // لو لم يحن عيد ميلاده هذا العام بعد، ننقص سنة.
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  // Math.max(0, age): نضمن ألا يعود رقم سالب (حالات خطأ).
  return Math.max(0, age);
}

/*
-----------------------------------------
الدالة: formatNumber
-----------------------------------------
وظيفتها: تنسيق رقم بالأرقام العربية (مثل 1,234 بدل 1234).
Input: رقم + عدد الخانات العشرية المطلوب.
Output: نص منسق، أو '—' لو القيمة غير موجودة.
-----------------------------------------
*/
/** تنسيق رقم عربي */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  // لو القيمة null أو غير محددة أو ليست رقمًا → نعرض شرطة (—).
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  // toLocaleString('ar-EG'): يجعل المتصفح ينسق الرقم بالعربية.
  return n.toLocaleString('ar-EG', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

/** تنسيق تاريخ عربي طويل (مثال: 14 أغسطس 2026) */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  // التاريخ قد يصل كنص (String) من قاعدة البيانات — نحوله إلى كائن Date.
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** تنسيق تاريخ عربي مختصر بالأرقام (مثال: 14/8/2026) */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

/** نسبة آمنة 0-100 — نمنع النسبة من الخروج خارج الحدود */
export function clampPercent(n: number): number {
  // Math.min(100, ...): لا تسمح بالزيادة عن 100.
  // Math.max(0, ...): لا تسمح بالنزول تحت صفر.
  return Math.min(100, Math.max(0, n));
}

/** إنشاء معرّف قصير عشوائي (مستخدم في بعض الأجزاء المؤقتة) */
export function shortId(): string {
  // toString(36): يحول الرقم إلى حروف وأرقام (base 36).
  // slice(2, 10): يأخذ 8 خانات من منتصف النص العشوائي.
  return Math.random().toString(36).slice(2, 10);
}

/** إرجاع تاريخ اليوم مع تصفير الساعة والدقائق (بداية اليوم تمامًا) */
export function startOfToday(): Date {
  const d = new Date();
  // setHours(0,0,0,0): صفر للساعة/الدقيقة/الثانية/المللي ثانية.
  // الفائدة: المقارنة بين سجلات "اليوم" تصبح سهلة.
  d.setHours(0, 0, 0, 0);
  return d;
}
