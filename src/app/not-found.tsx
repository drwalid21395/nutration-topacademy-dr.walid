import Link from 'next/link';
import { Waves } from 'lucide-react';

export const metadata = { title: 'الصفحة غير موجودة' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ocean-950 px-4 text-center text-white">
      <Waves className="h-16 w-16 text-ocean-400" />
      <h1 className="mt-6 text-5xl font-black">404</h1>
      <p className="mt-2 text-lg font-bold">هذه الصفحة غاصت في المسبح ولم نجدها</p>
      <p className="mt-1 max-w-md text-sm text-slate-400">ربما الرابط غير صحيح أو الصفحة أُزيلت. لنعد بك إلى اليابسة الآمنة.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-gold">العودة للرئيسية</Link>
        <Link href="/dashboard" className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">لوحة التحكم</Link>
      </div>
    </div>
  );
}
