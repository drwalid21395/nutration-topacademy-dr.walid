/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/coach/coach-dashboard.tsx

وظيفة الملف:
لوحة المدرب / الاختصاصي — تعرض سباحيه (من يرتبط بهم):
- قائمة السباحين مع إحصائيات 7 أيام (طعام، تدريب، وزن).
- خطة كل سباح الحالية.
- صلاحيات يتحكم فيها المدرب (تعديل الخطة / رؤية البيانات الصحية).
- نموذج إضافة سباح جديد بالبريد الإلكتروني.

لماذا نحتاجه؟
المدرب أو الاختصاصي الغذائي يحتاج متابعة التزام سباحيه
والتواصل معهم وإدارة صلاحيات الوصول.

'use client':
يعمل في المتصفح لأنه يستخدم useState وuseEffect وfetch
وعناصر تفاعلية (نموذج، خانات اختيار).

متى يعمل؟
عند فتح /coach/dashboard (لأدوار coach وdietitian).

من يستدعي هذا الملف؟
src/app/coach/dashboard/page.tsx.

الملفات التي يتعامل معها:
- API: /api/coach/athletes (قائمة، إضافة، تحديث الصلاحيات).
- UI: Button، Input/Field، Card، Badge، Alert، EmptyState، UserAvatar.
- lib/utils: formatDate.

ترتيب العمل:
1. التحميل: نجلب قائمة السباحين من الخادم ↓
2. نعرض بطاقة لكل سباح مع إحصائياته وصلاحياته ↓
3. المدرب يعدّل خانات الصلاحية → PATCH ↓
4. أو يضيف سباحًا جديدًا من النموذج → POST ↓
5. بعد كل عملية نعيد تحميل القائمة (load)
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useEffect (كود بعد العرض)، useState (حالة متغيرة) — من مكتبة react.
import { useEffect, useState } from 'react';
// أيقونات من lucide-react (مكتبة خارجية).
import { Users, UserPlus, Trash2, Mail, ClipboardList, Utensils, Dumbbell, Weight } from 'lucide-react';
// Button: زر جاهز من مكونات الواجهة.
import { Button } from '@/components/ui/button';
// Input وField: حقول النموذج الجاهزة.
import { Input, Field } from '@/components/ui/forms';
// مكونات واجهة جاهزة.
import { Card, Badge, Alert, EmptyState } from '@/components/ui';
// UserAvatar: صورة المستخدم.
import { UserAvatar } from '@/components/ui/user-avatar';
// formatDate: تنسيق التواريخ.
import { formatDate } from '@/lib/utils';

// ========================================
// 2. المكوّن الرئيسي: CoachDashboard
// ========================================

// CoachDashboard: اللوحة الكاملة.
// Props: isDietitian (هل المستخدم اختصاصي؟ يغيّر عنوان اللوحة).
export function CoachDashboard({ isDietitian }: { isDietitian: boolean }) {
  // athletes: قائمة السباحين المرتبطين بالمدرب.
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // email: حقل إضافة سباح جديد.
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // load: جلب قائمة السباحين من /api/coach/athletes.
  const load = async () => {
    const res = await fetch('/api/coach/athletes');
    const d = await res.json();
    setAthletes(d.athletes ?? []);
    setLoading(false);
  };

  // عند أول ظهور: نجلب القائمة.
  useEffect(() => {
    load();
  }, []);

  // addAthlete: إضافة سباح جديد بالبريد الإلكتروني.
  // نرسل النموذج عبر POST ثم نعيد تحميل القائمة.
  async function addAthlete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch('/api/coach/athletes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? 'تعذر الإضافة');
      return;
    }
    setEmail('');
    setMessage('تمت إضافة السباح بنجاح.');
    load();
  }

  // togglePerm: تفعيل/إلغاء صلاحية (تعديل الخطة أو رؤية الصحة).
  // نرسل PATCH باسم الصلاحية وقيمتها الجديدة.
  async function togglePerm(relationId: string, key: 'canEditPlan' | 'canViewHealth', val: boolean) {
    await fetch('/api/coach/athletes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationId, [key]: val }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6">
        {/* العنوان يتغير حسب الدور */}
        <h1 className="text-2xl font-black text-ocean-900">{isDietitian ? 'لوحة الاختصاصي' : 'لوحة المدرب'}</h1>
        <p className="mt-1 text-sm text-slate-500">تابع سباحيك، راقب الالتزام، وتابع تقاريرهم الأسبوعية.</p>
      </div>

      {message && <div className="mb-4"><Alert variant="success">{message}</Alert></div>}
      {error && <div className="mb-4"><Alert variant="danger">{error}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ocean-900">
            <Users className="h-5 w-5 text-ocean-500" />
            السباحون ({athletes.length})
          </h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>
          ) : athletes.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="لا يوجد سباحون بعد"
              description="أضف سباحًا ببريده الإلكتروني ليظهر هنا وتتمكن من متابعة التزامه."
            />
          ) : (
            <div className="space-y-3">
              {/* map: بطاقة لكل سباح. نقوم بتفكيك بياناته في التدمير
                  relation = العلاقة، athlete = الحساب، profile = ملف السباح،
                  logs7d = إحصائيات الأسبوع، plan = الخطة الحالية */}
              {athletes.map(({ relation, athlete, profile, logs7d, plan }) => (
                <Card key={relation.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={athlete.name} image={athlete.image} size="md" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{profile?.fullName ?? athlete.name}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-400"><Mail className="h-3 w-3" /> {athlete.email}</p>
                        {/* شارات الملف إن وُجدت */}
                        {profile && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {profile.ageGroup && <Badge color="slate">{profile.ageGroup}</Badge>}
                            {profile.swimmerLevel && <Badge color="ocean">{profile.swimmerLevel}</Badge>}
                            {profile.goal && <Badge color="gold">{profile.goal}</Badge>}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge color={relation.status === 'active' ? 'green' : 'gold'}>
                      {relation.status === 'active' ? 'نشط' : 'معلق'}
                    </Badge>
                  </div>

                  {/* إحصائيات آخر 7 أيام: طعام، تدريب، وزن */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <Utensils className="mx-auto h-4 w-4 text-ocean-500" />
                      <p className="mt-1 text-sm font-black text-ocean-900">{logs7d.food}</p>
                      <p className="text-[10px] text-slate-400">سجل طعام (7 أيام)</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <Dumbbell className="mx-auto h-4 w-4 text-ocean-500" />
                      <p className="mt-1 text-sm font-black text-ocean-900">{logs7d.training}</p>
                      <p className="text-[10px] text-slate-400">جلسات تدريب</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <Weight className="mx-auto h-4 w-4 text-ocean-500" />
                      <p className="mt-1 text-sm font-black text-ocean-900">{logs7d.weight}</p>
                      <p className="text-[10px] text-slate-400">قياسات وزن</p>
                    </div>
                  </div>

                  {/* الخطة الحالية للسباح إن وُجدت */}
                  {plan && (
                    <p className="mt-2 text-xs text-slate-500">الخطة الحالية: <b>{plan.title}</b></p>
                  )}

                  {/* منطقة الصلاحيات */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex gap-3 text-slate-500">
                      {/* خانتا اختيار: عند تغييرهما نرسل PATCH فورًا */}
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded text-ocean-600" checked={relation.canEditPlan} onChange={(e) => togglePerm(relation.id, 'canEditPlan', e.target.checked)} />
                        تعديل الخطة
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded text-ocean-600" checked={relation.canViewHealth} onChange={(e) => togglePerm(relation.id, 'canViewHealth', e.target.checked)} />
                        رؤية البيانات الصحية
                      </label>
                    </div>
                    <span className="text-slate-400">أُضيف {formatDate(relation.createdAt)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ocean-900">
            <UserPlus className="h-4 w-4 text-ocean-500" />
            إضافة سباح
          </h2>
          {/* نموذج الإضافة: عند الإرسال نستدعي addAthlete */}
          <form onSubmit={addAthlete} className="space-y-3">
            <Field label="البريد الإلكتروني للسباح" required>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="swimmer@email.com" required />
            </Field>
            <Button type="submit" className="w-full">
              <UserPlus className="h-4 w-4" />
              إضافة للمتابعة
            </Button>
          </form>
          {/* ملاحظة توضيحية عن شروط الإضافة */}
          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            <ClipboardList className="mb-1 h-4 w-4 text-ocean-400" />
            لابد أن يكون السباح مسجلًا في المنصة بنفس البريد قبل إضافته. صلاحيات رؤية البيانات الصحية محكومة بالموافقة.
          </div>
        </Card>
      </div>
    </div>
  );
}
