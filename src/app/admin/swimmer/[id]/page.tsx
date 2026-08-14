/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/app/admin/swimmer/[id]/page.tsx

وظيفة الملف:
صفحة المشرف لتفاصيل سباح واحد (المسار /admin/swimmer/<معرف>).
تعرض: بيانات السباح، إحصائيات اليوم (سعرات/ماء/تمارين)،
خطته الغذائية الحالية، آخر الوجبات والتمارين والوزن،
تحليلات الوجبات بالذكاء الاصطناعي، الإشعارات، وأزرار
تقرير PDF/Excel.

لماذا نحتاجه؟
حتى يتابع المشرف/الطبيب التزام سباح بعينه ويطبع تقارير
له دون الدخول بحسابه.

نوعها: Server Component (بدون 'use client').
تعمل في الخادم وتقرأ قاعدة البيانات قبل إرسال الصفحة —
مهم لأنها تعرض بيانات خاصة ولا يجب كشفها للمتصفح قبل التحقق.

متى يعمل؟
عند فتح /admin/swimmer/<id> من لوحة الإدارة.

من يستدعي هذا الملف؟
Next.js يعرضه تلقائيًا؛ المشرف يصل إليه بالضغط على اسم
سباح في لوحة الإدارة.

الملفات التي يتعامل معها:
- getCurrentUser من lib/auth و prisma من lib/prisma.
- AppShell (الإطار العام).
- مكونات UI (Card, Badge, EmptyState, UserAvatar...).
- MealAnalysisCard و parseMealFoods من components/analyzer.
- دوال التنسيق formatNumber/formatDate/startOfToday من lib/utils.
- ثوابت ROLES و PLAN_TYPES من lib/constants.

ترتيب العمل:
1. فحص تسجيل الدخول والدور (admin فقط).
2. قراءة المعرّف من الرابط واستخراج السباح من قاعدة البيانات.
3. لو لا يوجد → صفحة 404.
4. جلب بياناته من 10 جداول بالتوازي.
5. حساب إحصاءات اليوم ومجموعات الأسبوع.
6. عرض كل شيء داخل الإطار العام.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

import { redirect, notFound } from 'next/navigation'; // redirect: نقل لصفحة أخرى. notFound: إظهار صفحة 404.
import Link from 'next/link'; // رابط داخلي سريع (بدون إعادة تحميل) — من مكتبة next/link.
import {
  Download,
  Utensils,
  Dumbbell,
  Droplets,
  Flame,
  Salad,
  Eye,
  MessageSquare,
  FileText,
  ArrowRight,
  ClipboardList,
  Pencil,
  Scale,
  Camera,
  Bell,
} from 'lucide-react'; // أيقونات من مكتبة lucide-react الخارجية لكل قسم في الصفحة.
import { getCurrentUser } from '@/lib/auth'; // دالة محلية: المستخدم المسجل حاليًا.
import { prisma } from '@/lib/prisma'; // عميل قاعدة البيانات (قراءة الجداول) — ملف محلي.
import { AppShell } from '@/components/layout/app-shell'; // الإطار العام — ملف محلي.
import { Card, CardHeader, Badge, EmptyState } from '@/components/ui'; // مكونات واجهة جاهزة — ملف محلي.
import { UserAvatar } from '@/components/ui/user-avatar'; // صورة المستخدم الدائرية — ملف محلي.
import { MealAnalysisCard, parseMealFoods } from '@/components/analyzer/meal-analysis-card'; // بطاقة عرض تحليل وجبة + دالة تحليل النص — ملف محلي.
import { formatNumber, formatDate, formatShortDate, startOfToday } from '@/lib/utils'; // أدوات تنسيق الأرقام والتواريخ — ملف محلي.
import { ROLES, PLAN_TYPES } from '@/lib/constants'; // أسماء الأدوار وأنواع الخطط بالعربية — ملف محلي.

// ========================================
// 2. بيانات التعريف
// ========================================

// metadata: عنوان الصفحة في تبويب المتصفح.
export const metadata = { title: 'متابعة السباح' };

// ========================================
// 3. الصفحة الرئيسية (تعمل في الخادم)
// ========================================

/*
دالة: AdminSwimmerDetailPage — تعرض تفاصيل سباح واحد.
متى تعمل؟ عند فتح /admin/swimmer/<id>.
خطواتها (قصة البيانات):
1. فحص الدور (admin فقط).
2. قراءة المعرّف من params (بيانات الرابط).
3. جلب السباح؛ لو غير موجود → 404.
4. جلب ملفه وخططه وسجلاته من عدة جداول بالتوازي.
5. حساب إحصاءات اليوم ومجموعات الأسبوع.
6. عرض كل البطاقات داخل الإطار العام.
*/
export default async function AdminSwimmerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // من هو المستخدم؟ لو لا أحد أو ليس مشرفًا → ننقله بعيدًا.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  // params: كائن المعرّفات القادمة من الرابط. في Next.js 15 يكون Promise
  // فننتظره بـ await ثم نستخرج id (المعرّف الذي في أقواس الملف).
  const { id } = await params;

  // نجلب السباح من جدول User بشرط: دوره سباح وغير محذوف.
  // select: نأخذ أعمدة محددة فقط (أداء أفضل، ولا نأخذ كلمة المرور).
  const swimmer = await prisma.user.findFirst({
    where: { id, role: 'athlete', status: { not: 'deleted' } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  // لو لم يوجد سباح بهذا المعرّف → نعرض 404 ونوقف التنفيذ.
  if (!swimmer) notFound();

  // بداية اليوم (منتصف الليل) لحساب سجلات اليوم،
  // وناريخ قبل 6 أيام لنحصل على أسبوع كامل.
  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 6);

  // Promise.all: جلب 10 مجموعات بيانات في نفس الوقت (أسرع بكثير من التسلسل).
  const [profile, plan, foodToday, foodWeek, trainings, waters, weights, analyses, notifications, planCount] =
    await Promise.all([
      // 1. آخر ملف سباح للمستخدم.
      prisma.swimmerProfile.findFirst({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      // 2. الخطة النشطة الحالية + أرقامها الغذائية فقط.
      prisma.mealPlan.findFirst({
        where: { userId: id, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, planType: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true, durationDays: true, createdAt: true },
      }),
      // 3. وجبات اليوم (من بداية اليوم فصاعدًا).
      prisma.foodLogEntry.findMany({
        where: { userId: id, date: { gte: todayStart } },
        orderBy: { createdAt: 'asc' },
      }),
      // 4. آخر 30 وجبة خلال الأسبوع (للرسوم والأيام النشطة).
      prisma.foodLogEntry.findMany({
        where: { userId: id, date: { gte: weekAgo } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      // 5. آخر 15 تمرينًا.
      prisma.trainingLogEntry.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: 15,
      }),
      // 6. سجلات الماء لليوم.
      prisma.waterLogEntry.findMany({
        where: { userId: id, date: { gte: todayStart } },
      }),
      // 7. آخر 10 قياسات وزن.
      prisma.weightLogEntry.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      // 8. آخر 5 تحليلات وجبات بالذكاء الاصطناعي + صورة كل تحليل.
      prisma.mealAnalysis.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { photo: { select: { url: true } } },
      }),
      // 9. آخر 10 إشعارات.
      prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 10. عدد خططه الإجمالية (لرسالة "لا خطة نشطة").
      prisma.mealPlan.count({ where: { userId: id } }),
    ]);

  // إحصاءات اليوم: نجمع السعرات والبروتين والماء من السجلات.
  // reduce: يمر على كل عنصر ويجمع القيم (a = المجموع، f = العنصر).
  const caloriesToday = foodToday.reduce((a, f) => a + (f.calories ?? 0), 0);
  const proteinToday = foodToday.reduce((a, f) => a + (f.proteinG ?? 0), 0);
  const waterToday = waters.reduce((a, w) => a + w.amountMl, 0);
  const mealsToday = foodToday.length;
  // عدد التمارين التي تاريخها اليوم أو بعده.
  const trainingsToday = trainings.filter((t) => t.date >= todayStart).length;

  // Map: نجمع سعرات كل يوم من أيام الأسبوع تحت مفتاحه (التاريخ كنص).
  // القيمة: كائن فيه السعرات وعدد الوجبات لذلك اليوم.
  const weekFoods = new Map<string, { cals: number; count: number }>();
  for (const f of foodWeek) {
    // نأخذ جزء التاريخ فقط (YYYY-MM-DD) ليكون مفتاحًا.
    const key = f.date.toISOString().slice(0, 10);
    // لو اليوم غير موجود نبدأ من صفر.
    const cur = weekFoods.get(key) ?? { cals: 0, count: 0 };
    cur.cals += f.calories ?? 0;
    cur.count += 1;
    weekFoods.set(key, cur);
  }
  // عدد الأيام التي سُجل فيها طعام (لقياس الالتزام خلال الأسبوع).
  const daysActive = weekFoods.size;

  // دالة نسبة مئوية: تعيد النسبة لكن بحد أقصى 100، أو null لو الهدف صفر.
  const pct = (v: number, t: number | null | undefined) => (t && t > 0 ? Math.min(100, Math.round((v / t) * 100)) : null);
  // نسبة السعرات المستهلكة من خطة اليوم (قد تكون null).
  const calsPct = pct(caloriesToday, plan?.totalCalories);

  // ========================================
  // 4. عرض الواجهة (JSX)
  // ========================================
  return (
    <AppShell user={user}>
      {/* زر رجوع إلى لوحة الإدارة (مخفى عند الطباعة بـ no-print). */}
      <Link href="/admin/dashboard" className="no-print mb-4 inline-flex items-center gap-1 text-xs font-bold text-ocean-600 hover:underline">
        <ArrowRight className="h-3.5 w-3.5" />
        عودة إلى لوحة الإدارة
      </Link>

      {/* بطاقة رأس السباح: اسمه وصورته وحالته وأزرار المتابعة */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* الاسم والصورة: UserAvatar يرسم صورة أو حروفًا إن لم توجد صورة.
              الاسم: اسم ملف السباح إن وُجد وإلا اسم الحساب. */}
          <div className="flex items-center gap-3 sm:gap-4">
            <UserAvatar name={swimmer.name} image={swimmer.image} size="xl" className="h-14 w-14 sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black text-ocean-900 sm:text-2xl">{profile?.fullName ?? swimmer.name}</h1>
                {/* شارة الحالة: نشط (أخضر) أم معلق (ذهبي). */}
                <Badge color={swimmer.status === 'active' ? 'green' : 'gold'}>
                  {swimmer.status === 'active' ? 'نشط' : 'معلق'}
                </Badge>
                {/* شارة الدور: تحويل مفتاح الدور لاسمه العربي عبر ROLES. */}
                <Badge color="ocean">{ROLES[swimmer.role as keyof typeof ROLES] ?? swimmer.role}</Badge>
              </div>
              {/* البريد معروض باتجاه لاتيني (dir=ltr) لأنه إنجليزي غالبًا. */}
              <p className="mt-1 truncate text-sm text-slate-500" dir="ltr">{swimmer.email}</p>
              <p className="mt-1 text-xs text-slate-400">
                انضم {formatDate(swimmer.createdAt)}
                {swimmer.lastLoginAt ? ` · آخر دخول ${formatDate(swimmer.lastLoginAt)}` : ''}
              </p>
            </div>
          </div>
          {/* أزرار سريعة: ملخص البيانات ومراسلة السباح. */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href={`/my-profile?userId=${swimmer.id}`} className="btn-secondary w-full sm:w-auto">
              <ClipboardList className="h-4 w-4" />
              ملخص البيانات
            </Link>
            <Link href={`/messages?userId=${swimmer.id}`} className="btn-secondary w-full sm:w-auto">
              <MessageSquare className="h-4 w-4" />
              مراسلة
            </Link>
          </div>
        </div>

        {/* إحصائيات اليوم */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-ocean-50 p-3 text-center">
            <Flame className="mx-auto h-5 w-5 text-ocean-500" />
            <p className="mt-1 text-lg font-black text-ocean-900">{formatNumber(caloriesToday)}</p>
            <p className="text-xs font-semibold text-slate-400">
              سعرة اليوم{calsPct !== null ? ` · ${calsPct}% من الخطة` : ''}
            </p>
          </div>
          <div className="rounded-xl bg-gold-300/20 p-3 text-center">
            <Utensils className="mx-auto h-5 w-5 text-gold-500" />
            <p className="mt-1 text-lg font-black text-ocean-900">{mealsToday}</p>
            <p className="text-xs font-semibold text-slate-400">وجبة مسجلة اليوم · {proteinToday} جم بروتين</p>
          </div>
          <div className="rounded-xl bg-lagoon-100 p-3 text-center">
            <Droplets className="mx-auto h-5 w-5 text-lagoon-600" />
            <p className="mt-1 text-lg font-black text-ocean-900">{formatNumber(waterToday, 0)} مل</p>
            <p className="text-xs font-semibold text-slate-400">ماء اليوم</p>
          </div>
          <div className="rounded-xl bg-emerald-100 p-3 text-center">
            <Dumbbell className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-1 text-lg font-black text-ocean-900">{trainingsToday}</p>
            <p className="text-xs font-semibold text-slate-400">تمرين اليوم · {daysActive}/7 أيام تسجيل</p>
          </div>
        </div>
      </Card>

      {/* بطاقة الخطة الغذائية الحالية: لو توجد خطة نشطة نعرض أرقامها، وإلا نعرض حالة فارغة */}
      <div className="mt-5">
        {plan ? (
          <Card className="p-4 sm:p-5">
            <CardHeader
              icon={<Salad className="h-5 w-5" />}
              title="الخطة الغذائية الحالية"
              action={
                <div className="flex flex-wrap gap-2">
                  <Badge color="gold">{PLAN_TYPES[plan.planType as keyof typeof PLAN_TYPES] ?? 'خطة غذائية'}</Badge>
                  <Badge>{plan.durationDays} يوم</Badge>
                </div>
              }
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-ocean-50 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">السعرات</p>
                <p className="mt-0.5 text-lg font-black text-ocean-900">{formatNumber(plan.totalCalories)}</p>
              </div>
              <div className="rounded-xl bg-gold-300/20 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">البروتين</p>
                <p className="mt-0.5 text-lg font-black text-ocean-900">{formatNumber(plan.proteinG, 1)} جم</p>
              </div>
              <div className="rounded-xl bg-emerald-100 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">الكربوهيدرات</p>
                <p className="mt-0.5 text-lg font-black text-ocean-900">{formatNumber(plan.carbsG, 1)} جم</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">الدهون</p>
                <p className="mt-0.5 text-lg font-black text-ocean-900">{formatNumber(plan.fatG, 1)} جم</p>
              </div>
              <div className="rounded-xl bg-lagoon-100 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">الماء</p>
                <p className="mt-0.5 text-lg font-black text-ocean-900">{formatNumber((plan.waterMl ?? 0) / 1000, 1)} لتر</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-400">أُنشئت</p>
                <p className="mt-0.5 text-sm font-bold text-ocean-900">{formatShortDate(plan.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/plan/${plan.id}`} className="btn-primary w-full sm:w-auto">
                <Eye className="h-4 w-4" />
                عرض البرنامج
              </Link>
              <a href={`/api/plan/${plan.id}/pdf`} className="btn-secondary w-full sm:w-auto">
                <Download className="h-4 w-4" />
                تحميل PDF
              </a>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<Salad className="h-10 w-10" />}
            title="لا توجد خطة نشطة"
            description={`السباح لديه ${planCount} خطة إجمالًا لكن لا توجد خطة نشطة حاليًا.`}
            action={
              <Link href={`/my-profile?userId=${swimmer.id}`} className="btn-secondary">
                <Pencil className="h-4 w-4" />
                عرض ملف السباح
              </Link>
            }
          />
        )}
      </div>

      {/* شبكة بطاقات سجل النشاط: آخر الوجبات والتمارين والوزن والتحليلات والإشعارات */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* آخر الوجبات المسجلة (أول 10 من الأسبوع) */}
        <Card className="p-4 sm:p-5">
          <CardHeader icon={<Utensils className="h-5 w-5" />} title="آخر الوجبات المسجلة" />
          {foodWeek.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد وجبات مسجلة خلال الأسبوع الأخير.</p>
          ) : (
            <div className="space-y-2">
              {foodWeek.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 sm:gap-3 sm:px-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{f.foodName}</p>
                    <p className="text-[10px] text-slate-400">{formatShortDate(f.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-black text-ocean-900">{formatNumber(f.calories)} سعرة</p>
                    {f.proteinG ? <p className="text-[10px] text-slate-400">بروتين {formatNumber(f.proteinG, 1)} جم</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* آخر التمارين (سباحة أو لياقة حسب النوع) */}
        <Card className="p-4 sm:p-5">
          <CardHeader icon={<Dumbbell className="h-5 w-5" />} title="آخر التمارين" />
          {trainings.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد تمارين مسجلة.</p>
          ) : (
            <div className="space-y-2">
              {trainings.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 sm:gap-3 sm:px-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{t.sessionType === 'gym' ? 'تمرين لياقة' : 'تمرين سباحة'}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatShortDate(t.date)}
                      {t.intensity ? ` · شدّة ${t.intensity}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-black text-ocean-900">{t.durationMin ?? 0} دقيقة</p>
                    {t.distanceM ? <p className="text-[10px] text-slate-400">{formatNumber(t.distanceM)} م</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* آخر قياسات الوزن (شبكة صغيرة من آخر 10) */}
        <Card className="p-4 sm:p-5">
          <CardHeader icon={<Scale className="h-5 w-5" />} title="آخر قياسات الوزن" />
          {weights.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد قياسات وزن.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {weights.map((w) => (
                <div key={w.id} className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-base font-black text-ocean-900">{formatNumber(w.weightKg, 1)} كجم</p>
                  <p className="text-[10px] text-slate-400">{formatShortDate(w.date)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* تحليلات الوجبات (AI): لكل تحليل نعرض بطاقة MealAnalysisCard.
            parseMealFoods: تحويل نص الأطعمة المخزن إلى مصفوفة أطعمة منظمة. */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <CardHeader
            icon={<Camera className="h-5 w-5" />}
            title="تحليلات الوجبات (AI)"
            subtitle="آخر تحليلات صور الوجبات — مكونات وإجماليات كل وجبة."
          />
          {analyses.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد تحليلات.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {analyses.map((a) => (
                <MealAnalysisCard
                  key={a.id}
                  foods={parseMealFoods(a.foods)}
                  photoUrl={a.photo?.url}
                  provider={a.provider}
                  confidence={a.confidence}
                  needsReview={a.needsReview}
                  totalCalories={a.totalCalories}
                  totalProteinG={a.totalProteinG}
                  totalCarbsG={a.totalCarbsG}
                  totalFatG={a.totalFatG}
                  totalFiberG={a.totalFiberG}
                  totalSodiumMg={a.totalSodiumMg}
                  notes={a.notes}
                  createdAt={a.createdAt}
                />
              ))}
            </div>
          )}
        </Card>

        {/* الإشعارات المرسلة للسباح (آخر 10) */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <CardHeader icon={<Bell className="h-5 w-5" />} title="الإشعارات" />
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد إشعارات.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatShortDate(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* بطاقة التقرير: أزرار PDF وExcel لآخر 7 أيام (API /api/admin/reports) */}
      <div className="mt-5">
        <Card className="p-4 sm:p-5">
          <CardHeader
            icon={<FileText className="h-5 w-5" />}
            title="تقرير الالتزام التفصيلي"
            subtitle="تقرير PDF أو Excel للسباح خلال آخر 7 أيام."
            action={
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <a href={`/api/admin/reports?format=pdf&userId=${swimmer.id}&days=7`} className="btn-primary w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  تقرير PDF
                </a>
                <a href={`/api/admin/reports?format=csv&userId=${swimmer.id}&days=7`} className="btn-secondary w-full sm:w-auto">
                  <Download className="h-4 w-4" />
                  تقرير Excel
                </a>
              </div>
            }
          />
        </Card>
      </div>
    </AppShell>
  );
}
