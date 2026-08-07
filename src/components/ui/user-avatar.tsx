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
  const sizes = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-11 w-11 text-base',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  } as const;

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
