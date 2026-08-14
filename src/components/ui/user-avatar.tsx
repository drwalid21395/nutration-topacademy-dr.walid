/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/ui/user-avatar.tsx

وظيفة الملف:
مكوّن صورة المستخدم الدائرية — يعرض صورة المستخدم إن
وُجدت، وإلا يعرض أول حرف من اسمه في دائرة ملونة.

لماذا نحتاجه؟
في كل مكان نعرض فيه اسم المستخدم (الهيدر، الملف الشخصي،
المحادثات، لوحة الكوتش) نريد صورة موحّدة ومتناسقة، وإن لم
توجد صورة نعرض بديلًا أنيقًا بدل كسر الصفحة.

'use client'؟
لا نحتاجه — هذا مكوّن عرض (UI) خالص يعمل على الخادم أيضًا.

متى يعمل؟
في أي وقت يُضمَّن في صفحة (الهيدر، الملف، المحادثات، ...).

من يستدعي هذا الملف؟
- AppHeader، ProfilePage، SwimmerProfileForm، Messages،
  Navbar، والعديد من المكوّنات الأخرى.

الملفات التي يتعامل معها:
- lib/utils (دالة cn لدمج أصناف CSS).
- لا يتصل بأي API — مجرد عرض.

ترتيب العمل:
1. نستقبل: الاسم والصورة والحجم المطلوب ↓
2. نختار أصناف الحجم (sm/md/lg/xl) ↓
3. إن وُجدت صورة → نعرضها (img) ↓
4. إن لم توجد → نعرض أول حرف من الاسم في دائرة متدرجة
==================================================
*/

import { cn } from '@/lib/utils';

/**
 * صورة المستخدم — تعرض الصورة إذا وُجدت، وإلا أول حرف من الاسم.
 */
export function UserAvatar({
  name,
  image,
  size = 'md',
  className,
}: {
  name?: string | null;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  // sizes: أحجام جاهزة للصورة — كل حجم يضبط الطول/العرض/الخط.
  const sizes = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-11 w-11 text-base',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  } as const;

  // إن وُجدت صورة: نعرضها داخل دائرة (rounded-full) مع إطار أزرق.
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? ''}
        className={cn(sizes[size], 'shrink-0 rounded-full object-cover ring-2 ring-ocean-200', className)}
      />
    );
  }

  // لا توجد صورة: دائرة بتدرج أزرق تعرض أول حرف من الاسم
  // (وإن لم يوجد اسم نعرض "؟" كبديل).
  return (
    <div
      className={cn(
        sizes[size],
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ocean-500 to-ocean-700 font-black text-white',
        className
      )}
    >
      {(name ?? '؟').charAt(0)}
    </div>
  );
}
