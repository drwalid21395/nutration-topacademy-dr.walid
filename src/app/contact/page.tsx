import { Mail, MessageSquare, Clock, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'تواصل معنا' };

export default async function ContactPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar isLoggedIn={!!user} />
      <main className="water-bg">
        <section className="container-app py-16">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h1 className="text-3xl font-black text-ocean-900">تواصل معنا</h1>
              <p className="mt-3 text-slate-600">نسعد بأسئلتك وملاحظاتك حول المنصة أو المحتوى العلمي.</p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="card text-center">
                <Mail className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">البريد الإلكتروني</h3>
                <p className="mt-1 text-xs text-slate-500" dir="ltr">support@top-academy.example</p>
              </div>
              <div className="card text-center">
                <MessageSquare className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">الرد السريع</h3>
                <p className="mt-1 text-xs text-slate-500">نرد خلال 24-48 ساعة عمل</p>
              </div>
              <div className="card text-center">
                <Clock className="mx-auto h-7 w-7 text-ocean-500" />
                <h3 className="mt-2 text-sm font-bold text-ocean-900">ساعات الدعم</h3>
                <p className="mt-1 text-xs text-slate-500">السبت - الخميس · 9ص - 6م</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-ocean-100 bg-ocean-50/60 p-5 text-sm leading-relaxed text-ocean-800">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" />
                <span>
                  ننصح بالتواصل مع اختصاصي تغذية معتمد أو طبيب مختص مباشرةً لأي استشارة شخصية أو حالة صحية خاصة.
                  أسئلة الاستشارة الطبية لا يُجاب عنها عبر البريد العام.
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
