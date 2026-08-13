/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/providers.tsx

وظيفة الملف:
أصغر ملف مكون (7 أسطر). يغلف التطبيق داخل SessionProvider
من مكتبة next-auth.

لماذا نحتاجه؟
SessionProvider يتيح للمكونات في كل مكان (وخاصة مكونات
Client مثل أزرار تسجيل الدخول/الخروج) معرفة حالة الجلسة.
بدونه، signIn/signOut قد لا تعمل بشكل صحيح.

'use client':
أول سطر مهم جدًا — يخبر Next.js أن هذا المكون يعمل
"في المتصفح" (Client) وليس في الخادم.
مثال: دالة useEffect وlocalStorage لا تعمل في الخادم.

متى يعمل؟
مع كل صفحة من الصفحة الرئيسية حتى الدخول، لأنه مستخدم في layout.tsx.

من يستدعيه؟
src/app/layout.tsx

ما الذي يعالجه؟
children = كل محتوى الموقع القادم من الصفحة المطلوبة.
==================================================
*/

'use client';

// نستورد SessionProvider من next-auth (مكتبة خارجية).
// اسمها بدون مسار مجلد يعني أنها من node_modules.
import { SessionProvider } from 'next-auth/react';

// Props: المكون يستقبل children (المحتوى الذي سيغلفه).
// props = بيانات تُمرَّر للمكون من الأب. هنا children تحديدًا.
export function Providers({ children }: { children: React.ReactNode }) {
  // نغلف المحتوى كله داخل SessionProvider.
  // React.ReactNode = أي شيء يمكن عرضه (نص، عنصر، قائمة...).
  return <SessionProvider>{children}</SessionProvider>;
}
