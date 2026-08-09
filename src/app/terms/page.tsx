import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'شروط الاستخدام' };

const SECTIONS = [
  {
    title: 'القبول',
    body: 'باستخدامك المنصة فإنك توافق على هذه الشروط. لا يجوز استخدام المنصة لمن هم دون 13 عامًا دون إشراف ولي الأمر وبموافقته.',
  },
  {
    title: 'الاستخدام المسموح',
    body: 'المنصة لأغراض إدارة التغذية الرياضية والتثقيف. يُمنع إساءة استخدام النظام، أو محاولة الوصول غير المصرح به، أو نشر بيانات ضارة، أو انتحال شخصيات.',
  },
  {
    title: 'الإخلاء الطبي',
    body: 'جميع الحسابات والخطط والتوصيات إرشادية وتقديرية، ولا تشكل نصيحة طبية شخصية ولا تُغني عن استشارة الطبيب أو اختصاصي التغذية المعتمد، خصوصًا في الأمراض المزمنة والحساسية والقاصرين.',
  },
  {
    title: 'دقة البيانات',
    body: 'تقدر خوارزميات الحساب القيم بناءً على البيانات المدخلة وقد تختلف النتائج الفعلية. أنت مسؤول عن صحة البيانات التي تُدخلها.',
  },
  {
    title: 'المحتوى التثقيفي للمكملات',
    body: 'معلومات المكملات تثقيفية عامة فقط. لا توصي المنصة بأي جرعة ولا تُشجع على الاستخدام دون استشارة طبية. بعض المنتجات محظورة على القاصرين أو محظورة في المنشطات الرياضية.',
  },
  {
    title: 'الحسابات والأدوار',
    body: 'يملك السباح حساب بياناته. تمنح صلاحيات المدرب أو الاختصاصي حق الاطلاع بعلم وموافقة المستخدم. قد تُقيَّد حسابات مخالفة لهذه الشروط.',
  },
  {
    title: 'تعديل الخدمة',
    body: 'نحتفظ بالحق في تعديل الخدمة أو إيقافها مؤقتًا للصيانة أو التحديثات، أو تعديل هذه الشروط مع الإعلان عن التغيير.',
  },
  {
    title: 'الملكية الفكرية',
    body: 'العلامات التجارية والمحتوى والتصميم ملك للأكاديمية، ولا يجوز إعادة استخدامها لأغراض تجارية دون إذن كتابي.',
  },
];

export default async function TermsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar isLoggedIn={!!user} user={user} />
      <main className="water-bg">
        <section className="container-app py-16">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-black text-ocean-900">شروط الاستخدام</h1>
            <p className="mt-2 text-sm text-slate-500">آخر تحديث: يوليو 2026</p>
            <div className="mt-8 space-y-6">
              {SECTIONS.map((s, i) => (
                <div key={s.title}>
                  <h2 className="text-lg font-bold text-ocean-800">{i + 1}. {s.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
