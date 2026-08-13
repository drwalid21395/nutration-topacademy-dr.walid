/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/layout.tsx

وظيفة الملف:
"القالب الرئيسي" — كل صفحة في الموقع تُعرض داخل هذا الهيكل.
يحدد: اللغة، اتجاه الصفحة، الخطوط، الأيقونات، ومقدمي الخدمة.

لماذا نحتاجه؟
بدلًا من تكرار <html> و<head> في كل صفحة، نكتبه مرة واحدة هنا.
Next.js في نظام App Router يجعل هذا الملف إلزاميًا كبداية كل صفحة.

ترتيب العمل (الرحلة):
المستخدم يفتح أي عنوان في المتصفح
↓
Next.js يجد المسار المطابق في src/app
↓
layout.tsx يعمل أولًا (يجهز اللغة والخط والخلفيات)
↓
Providers يغلف المحتوى (جلسة الدخول)
↓
الصفحة المطلوبة تُعرض داخل هذا الهيكل

ملاحظة حول Server Component:
هذا الملف لا يحمل 'use client' — يعمل "في الخادم" (Server Component).
لذلك نستطيع قراءة البيانات من الخادم فيه لو أردنا. الجافاسكربت
المعروض هنا (script لخدمة PWA) يُرسل للمتصفح كنص عادي.

العلاقة مع الملفات:
- يستهلك Providers من components/providers.tsx.
- يستورد BRAND من lib/constants.ts.
- كل الصفحات داخل src/app تعتمد عليه.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// import type: نستورد "الأنواع" فقط (Metadata و Viewport) — لا قيم.
// Metadata: وصف الصفحة لمحركات البحث ووسائل التواصل.
// Viewport: إعدادات حجم العرض وتبويب الموقع.
import type { Metadata, Viewport } from 'next';
// استيراد ملف التنسيقات العام (يحتوي فئات Tailwind وكود CSS مخصص).
import './globals.css';
// Providers: مكون يغلف التطبيق بجلسة تسجيل الدخول (من ملفنا).
import { Providers } from '@/components/providers';
// BRAND: ثوابت اسم الأكاديمية والدكتور (من ملفنا src/lib/constants.ts).
import { BRAND } from '@/lib/constants';

// ========================================
// 2. بيانات التعريف (Meta) لمحركات البحث
// ========================================

// metadata: بيانات تُرسل داخل وسم <head> في HTML.
// محركات البحث (جوجل) ووسائل التواصل تقرأها لعرض عنوان ووصف.
export const metadata: Metadata = {
  title: {
    // default: العنوان عندما لا تحدد الصفحة عنوانًا خاصًا بها.
    default: `${BRAND.nameEn} — ${BRAND.productName}`,
    // template: %s تُستبدل بعنوان الصفحة الفرعية.
    // مثال: صفحة الدخول → "تسجيل الدخول | Top Academy".
    template: `%s | ${BRAND.nameEn}`,
  },
  description:
    'منصة Top Academy الذكية لإدارة التغذية الرياضية للسباحين: حساب الاحتياجات الغذائية، خطط غذائية مخصصة، تحليل الوجبات بالكاميرا، ومتابعة يومية شاملة.',
  // keywords: كلمات بحث (تأثيرها محدود حاليًا لدى جوجل).
  keywords: ['تغذية', 'سباحة', 'رياضي', 'خطط غذائية', 'Top Academy', 'تغذية سباحين'],
  authors: [{ name: BRAND.doctor }],
  // openGraph: كيف يظهر الرابط عند مشاركته في فيسبوك/واتساب.
  openGraph: {
    title: `${BRAND.nameEn} — ${BRAND.productName}`,
    description: 'خطط تغذية ذكية مبنية على العلم لرفع أداء السباح',
    type: 'website',
    locale: 'ar_EG',
  },
  // manifest: ملف إعدادات تطبيق الويب القابل للتثبيت (PWA).
  manifest: '/manifest.webmanifest',
  // appleWebApp: إعدادات عند إضافة الموقع لشاشة آيفون الرئيسية.
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Top Academy' },
};

// viewport: إعدادات شاشة الجوال وتبويب المتصفح.
export const viewport: Viewport = {
  themeColor: '#0a2438', // لون تبويب المتصفح (أزرق داكن)
  width: 'device-width', // عرض الصفحة = عرض الجهاز (تصميم متجاوب)
  initialScale: 1,
};

// ========================================
// 3. المكون الرئيسي (RootLayout)
// ========================================

/*
-----------------------------------------
الدالة: RootLayout
-----------------------------------------
وظيفتها: عرض هيكل الصفحة الكامل.
Input: children (المحتوى القادم من الصفحة المطلوبة).
Output: وثيقة HTML كاملة.
يتم استدعاؤها من: Next.js تلقائيًا لكل صفحة (الملف إلزامي الاسم).
-----------------------------------------
*/
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Readonly: نقول لـ TypeScript إن هذه القيمة للقراءة فقط (أمان).
  return (
    // lang="ar": لغة الصفحة عربية (مهم لقارئات الشاشة ومحركات البحث).
    // dir="rtl": اتجاه النص من اليمين لليسار (RTL).
    <html lang="ar" dir="rtl">
      <head>
        {/* preconnect: يخبر المتصفح بفتح اتصال مبكر بخوادم الخطوط
            = تحميل أسرع لخط Cairo. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* نحمّل خط Cairo من Google Fonts (الأوزان من 300 إلى 900). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* أيقونة الموقع في تبويب المتصفح. */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        {/* أيقونة آبل عند تثبيت الموقع كتطبيق. */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      {/* flex min-h-screen flex-col: جعل الصفحة بعرض كامل
          وتحتوي الأجزاء عموديًا (شريط علوي + محتوى + تذييل). */}
      <body className="flex min-h-screen flex-col">
        {/* Providers يغلف المحتوى — يفعّل جلسة تسجيل الدخول. */}
        <Providers>{children}</Providers>

        {/* سكربت PWA (تطبيق ويب قابل للتثبيت):
            يسجل Service Worker في المتصفح إذا كان مدعومًا.
            dangerouslySetInnerHTML: طريقة React لكتابة نص HTML
            كامل داخل عنصر — تُستخدم بحذر (انتبه: الاسم يحذرنا
            من أخطار أمنية، لكن هنا النص ثابت منا وليس من مستخدم). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
            `,
          }}
        />
      </body>
    </html>
  );
}
