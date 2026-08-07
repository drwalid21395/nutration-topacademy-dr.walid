import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getCurrentUser } from '@/lib/auth';
import { MEDICAL_DISCLAIMER, BRAND } from '@/lib/constants';

export const metadata = { title: 'إخلاء المسؤولية الطبية' };

export default async function MedicalDisclaimerPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar isLoggedIn={!!user} />
      <main className="water-bg">
        <section className="container-app py-16">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-black text-ocean-900">إخلاء المسؤولية الطبية</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{MEDICAL_DISCLAIMER}</p>

            <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
              <div>
                <h2 className="text-lg font-bold text-ocean-800">ما الذي تعنيه الخطط المعروضة؟</h2>
                <p className="mt-1.5">
                  الخطط المولَّدة من {BRAND.nameAr} هي {''}
                  <b>إرشادات عامة</b> مبنية على بيانات مدخلة ومعادلات تقريبية، وهدفها التعليم والمساعدة في بناء نظام غذائي
                  منظم. ليست وصفة علاجية لأي حالة مرضية، ولا بديلًا عن برنامج متخصص من إعداد أخصائي تغذية معتمد يتابع حالتك.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-bold text-ocean-800">حسابات تقديرية</h2>
                <p className="mt-1.5">
                  تعتمد الحسابات على معادلات مثل Mifflin-St Jeor وقد تختلف الاحتياجات الفعلية من شخص لآخر بسبب
                  الاستقلاب والكتلة العضلية والظروف الفردية. يُنصح بمراجعة الأرقام مع مختص وضبطها حسب استجابة الجسم.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-bold text-ocean-800">الحالات الصحية والقاصرون</h2>
                <p className="mt-1.5">
                  في حال وجود أمراض مزمنة (سكري، كلى، قلب، ضغط…) أو أدوية أو إصابات أو حمل أو سن أقل من 18، يتوقف
                  النظام عن إصدار خطط تفصيلية ويقدم تنبيهًا طبيًا وتوجيهًا للاستشارة، حفاظًا على السلامة.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-bold text-ocean-800">المكملات والمنشطات</h2>
                <p className="mt-1.5">
                  محتوى المكملات تثقيفي فقط. تحقق دائمًا من قوائم المنشطات المحظورة في رياضتك، واستشر طبيبك قبل أي
                  استخدام، خصوصًا للقاصرين.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-bold text-ocean-800">المسؤولية</h2>
                <p className="mt-1.5">
                  استخدام المنصة يكون على مسؤوليتك الشخصية. لا تتحمل الأكاديمية أو فريق الإشراف مسؤولية أي نتائج
                  صحية ناتجة عن تطبيق المحتوى دون استشارة طبية متخصصة.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
