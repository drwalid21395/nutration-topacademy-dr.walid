/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/profile/swimmer-profile-form.tsx

وظيفة الملف:
نموذج ملف السباح الكامل — مقسّم إلى 3 تبويبات:
1) البيانات الأساسية (اسم، جنس، عيد ميلاد، طول/وزن، مرحلة، مستوى، تخصص، بطولة)
2) بيانات التدريب (تمارين، شدّة، مسافات، نوم، راحة، تدريب مزدوج)
3) الغذاء والصحة (هدف، نظام غذائي، حساسية، أمراض، أدوية، قاصر وولي أمر)
+ رفع صورة شخصية (تصغير في المتصفح ثم حفظها في الخادم).
+ حفظ البيانات وحساب الاحتياجات الغذائية.

لماذا نحتاجه؟
هذه البيانات هي "عقل" النظام: كل خطة غذائية وتوصيات
مبنية على ما يُدخله المستخدم هنا.

'use client':
يعمل في المتصفح لأنه نموذج تفاعلي (useState، رفع صورة، fetch).

متى يعمل؟
عند فتح /profile أو أول تسجيل دخول (إكمال الملف).

من يستدعي هذا الملف؟
src/app/profile/page.tsx و src/app/onboarding (أو صفحة إكمال البيانات).

الملفات التي يتعامل معها:
- API: /api/profile (POST حفظ)، /api/profile/photo (POST رفع صورة).
- مكوّنات: Button، forms (Input/Select/Textarea/Field/Toggle)، ui (Alert/Card/Badge)، UserAvatar.
- lib/constants (قوائم الخيارات)، lib/utils (cn)، types (SwimmerFormData).
- next-auth (useSession لتحديث الجلسة بعد تغيير الصورة).

ترتيب العمل:
1. نستقبل بيانات السباح الحالية (initial) وصورته واسمه ↓
2. المستخدم ينتقل بين التبويبات ويملأ البيانات ↓
3. زر "حفظ" → POST إلى /api/profile ↓
4. لو وُجدت حالة صحية/قاصر → تحذير "الخطة إرشادية فقط" ↓
5. زر "حفظ ثم احسب احتياجاتي" → نفس الحفظ ثم الانتقال للحساب
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

// useRef (حقل ملف مخفي)، useState (حالة النموذج).
import { useRef, useState } from 'react';
// useRouter: إعادة رسم الصفحة بعد حفظ الصورة.
import { useRouter } from 'next/navigation';
// useSession: تحديث جلسة المستخدم (JWT) بعد تغيير الصورة.
import { useSession } from 'next-auth/react';
// أيقونات التبويبات والأزرار.
import { User, Dumbbell, HeartPulse, Check, Calculator, Camera, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Field, Toggle } from '@/components/ui/forms';
import { Alert, Card, Badge } from '@/components/ui';
import { UserAvatar } from '@/components/ui/user-avatar';
// قوائم الخيارات الجاهزة (الأعمار، المستويات، الأهداف، ...).
import {
  AGE_GROUPS,
  SWIMMER_LEVELS,
  SPECIALTIES,
  INTENSITY,
  GYM_TYPES,
  GOALS,
  DIET_TYPES,
  ACTIVITY_LEVELS,
  ROLES,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { SwimmerFormData } from '@/types';

// ========================================
// 2. التبويبات الثلاثة
// ========================================

const TABS = [
  { key: 'basic', label: 'البيانات الأساسية', icon: User },
  { key: 'training', label: 'بيانات التدريب', icon: Dumbbell },
  { key: 'nutrition', label: 'الغذاء والصحة', icon: HeartPulse },
];

// numberOrEmpty: تحويل رقم إلى نص للعرض في الحقول
// (والفارغ يعرض كخلية فارغة بدل "undefined").
function numberOrEmpty(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
}

// ========================================
// 3. المكوّن الرئيسي: SwimmerProfileForm
// ========================================

export function SwimmerProfileForm({
  initial,
  userImage,
  userName,
}: {
  initial: SwimmerFormData | null;
  userImage?: string | null;
  userName?: string | null;
}) {
  const router = useRouter();
  const { update: refreshSession } = useSession();
  // التبويب المفتوح حاليًا.
  const [tab, setTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // تنبيه طبي: يظهر إن وُجدت حالة صحية أو سباح قاصر.
  const [medicalAlert, setMedicalAlert] = useState<{ on: boolean; message: string } | null>(null);
  // صورة العرض الحالية (data URI).
  const [avatar, setAvatar] = useState<string | null>(userImage ?? null);
  const [uploading, setUploading] = useState(false);
  // مرجع لحقل الملف المخفي — نضغط عليه برمجيًا من زر "رفع صورة".
  const fileRef = useRef<HTMLInputElement>(null);

  // تصغير الصورة من المتصفح (أقصى 512px) مع ضغط JPEG لضمان وضوح كامل
  // وحجم صغير — تُخزَّن النتيجة كـ data URI تعرض دائمًا مهما فشل التخزين المحلي أو درايف.
  function fileToResizedDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('load'));
      };
      img.src = url;
    });
  }

  // onFilePicked: عند اختيار صورة من الحقل المخفي:
  // نتحقق من الحجم، نضغطها في المتصفح، نرفعها للخادم، ثم نحدّث الصورة والجلسة.
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // حد أقصى 2 ميجابايت.
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة يتجاوز 2 ميجابايت');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // ضغط الصورة داخل المتصفح (Canvas) → data URI.
      const dataUrl = await fileToResizedDataUrl(file);
      // رفع الصورة إلى الخادم.
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'تعذر رفع الصورة');
        return;
      }
      // نعرض الصورة الجديدة فورًا.
      setAvatar(data.image);
      // تحديث الجلسة (JWT) ثم إعادة رسم الصفحة حتى تظهر الصورة الجديدة
      // في هيدر التطبيق وباقي الصفحات دون الحاجة لتسجيل الخروج والدخول.
      try {
        await refreshSession();
      } catch {
        // التحديث اختياري
      }
      router.refresh();
    } catch {
      setError('تعذر رفع الصورة');
    } finally {
      setUploading(false);
    }
  }

  // d: كائن البيانات الكامل للنموذج — يبدأ من initial أو قيم افتراضية.
  const [d, setD] = useState<SwimmerFormData>(
    initial ?? {
      fullName: '',
      gender: 'male',
      hasDoubleTraining: false,
      isMinor: false,
    }
  );

  // set: دالة مساعدة لتحديث حقل واحد من بيانات النموذج.
  const set = <K extends keyof SwimmerFormData>(k: K, v: SwimmerFormData[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // saveAndFinish: يربطها الزرّان (حفظ / حفظ ثم حساب) — الحفظ نفسه.
  async function saveAndFinish() {
    await doSave();
  }

  // doSave: إرسال كل البيانات إلى الخادم عبر POST /api/profile.
  async function doSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'تعذر الحفظ');
      return;
    }
    setSuccess(true);
    // إن سجّل الخادم حالة صحية أو قاصرًا: نعرض تنبيهًا أن الخطة إرشادية فقط
    // ولا يقدم النظام أي توصيات علاجية أو جرعات.
    if (data.medicalAlert) {
      setMedicalAlert({
        on: true,
        message:
          'تم تسجيل حالة صحية أو سباح قاصر. الخطة ستكون إرشادية فقط، ويجب مراجعتها من اختصاصي تغذية رياضية وطبيب عند الحاجة — لن يقدم النظام أي توصيات علاجية أو جرعات.',
      });
    }
    // نخفي رسالة النجاح بعد 4 ثوانٍ.
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="space-y-6">
      {/* أزرار التبويبات الثلاثة — التبويب النشط بلون أزرق ممتلئ */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
              tab === t.key ? 'bg-ocean-600 text-white shadow-md' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-ocean-50'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* التنبيهات: طبي، نجاح، خطأ */}
      {medicalAlert?.on && (
        <Alert variant="danger" title="تنبيه طبي" dismissible onDismiss={() => setMedicalAlert(null)}>
          {medicalAlert.message}
        </Alert>
      )}
      {success && <Alert variant="success" title="تم الحفظ">تم حفظ بيانات السباح بنجاح.</Alert>}
      {error && <Alert variant="danger" title="خطأ">{error}</Alert>}

      {/* ============ البيانات الأساسية ============ */}
      {tab === 'basic' && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ocean-900">البيانات الأساسية</h2>
          <div className="mb-5 flex items-center gap-4 rounded-xl bg-ocean-50/60 p-4">
            <UserAvatar name={userName} image={avatar} size="xl" />
            <div>
              <p className="text-sm font-bold text-ocean-900">الصورة الشخصية</p>
              <p className="mt-0.5 text-xs text-slate-500">
                صورة توضيحية للسباح — تظهر في ملفه الشخصي ولوحات المتابعة. أقصى حجم 2 ميجابايت.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {avatar ? 'تغيير الصورة' : 'رفع صورة'}
                </Button>
                {avatar && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                    <X className="h-4 w-4" />
                    إزالة
                  </Button>
                )}
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFilePicked} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الاسم الكامل" required>
              <Input value={d.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="اسم السباح" />
            </Field>
            <Field label="الجنس" required>
              <Select value={d.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
            </Field>
            <Field label="تاريخ الميلاد" hint="يُحسب العمر تلقائيًا">
              <Input type="date" dir="ltr" value={d.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value)} />
            </Field>
            <Field label="الطول (سم)">
              <Input type="number" min={80} max={250} value={numberOrEmpty(d.heightCm)} onChange={(e) => set('heightCm', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="الوزن (كجم)">
              <Input type="number" min={15} max={400} value={numberOrEmpty(d.weightKg)} onChange={(e) => set('weightKg', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="الوزن المستهدف (كجم)">
              <Input type="number" min={15} max={400} value={numberOrEmpty(d.targetWeightKg)} onChange={(e) => set('targetWeightKg', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="نسبة الدهون (٪) — إن توفرت">
              <Input type="number" min={1} max={70} value={numberOrEmpty(d.bodyFatPercent)} onChange={(e) => set('bodyFatPercent', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="محيط الخصر (سم) — اختياري">
              <Input type="number" min={30} max={200} value={numberOrEmpty(d.waistCm)} onChange={(e) => set('waistCm', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="الدولة">
              <Input value={d.country ?? ''} onChange={(e) => set('country', e.target.value)} />
            </Field>
            <Field label="المرحلة العمرية">
              <Select value={d.ageGroup ?? ''} onChange={(e) => set('ageGroup', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(AGE_GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="مستوى السباح">
              <Select value={d.swimmerLevel ?? ''} onChange={(e) => set('swimmerLevel', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(SWIMMER_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="نوع السباحة / التخصص">
              <Select value={d.specialty ?? ''} onChange={(e) => set('specialty', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(SPECIALTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="المسافات الأساسية">
              <Input value={d.mainDistances ?? ''} placeholder="مثال: 50م، 100م، 200م حرة" onChange={(e) => set('mainDistances', e.target.value)} />
            </Field>
            <Field label="أفضل الأرقام الشخصية — اختياري">
              <Input value={d.personalBests ?? ''} placeholder="مثال: 100م حرة 0:58" onChange={(e) => set('personalBests', e.target.value)} />
            </Field>
            <Field label="موعد البطولة القادمة">
              <Input type="date" dir="ltr" value={d.nextCompetitionDate ?? ''} onChange={(e) => set('nextCompetitionDate', e.target.value)} />
            </Field>
          </div>
        </Card>
      )}

      {/* ============ بيانات التدريب ============ */}
      {tab === 'training' && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ocean-900">بيانات التدريب</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="تمرينات السباحة أسبوعيًا">
              <Input type="number" min={0} max={20} value={numberOrEmpty(d.swimSessionsPerWeek)} onChange={(e) => set('swimSessionsPerWeek', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="مدة تمرين السباحة (دقيقة)">
              <Input type="number" min={0} max={480} value={numberOrEmpty(d.swimMinutesPerSession)} onChange={(e) => set('swimMinutesPerSession', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="شدة التدريب">
              <Select value={d.trainingIntensity ?? ''} onChange={(e) => set('trainingIntensity', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(INTENSITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="المسافة التقريبية لكل تمرين (م)">
              <Input type="number" min={0} max={30000} value={numberOrEmpty(d.swimDistancePerSession)} onChange={(e) => set('swimDistancePerSession', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="تمرينات اللياقة/الجيم أسبوعيًا">
              <Input type="number" min={0} max={14} value={numberOrEmpty(d.gymSessionsPerWeek)} onChange={(e) => set('gymSessionsPerWeek', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="مدة تمرين اللياقة (دقيقة)">
              <Input type="number" min={0} max={480} value={numberOrEmpty(d.gymMinutesPerSession)} onChange={(e) => set('gymMinutesPerSession', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="نوع تمرينات اللياقة">
              <Select value={d.gymType ?? ''} onChange={(e) => set('gymType', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(GYM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="أيام الراحة">
              <Input value={d.restDays ?? ''} placeholder="مثال: الجمعة والسبت" onChange={(e) => set('restDays', e.target.value)} />
            </Field>
            <Field label="وقت التدريب المعتاد">
              <Input type="time" dir="ltr" value={d.trainingTime ?? ''} onChange={(e) => set('trainingTime', e.target.value)} />
            </Field>
            <Field label="ساعات النوم">
              <Input type="number" min={1} max={24} step={0.5} value={numberOrEmpty(d.sleepHours)} onChange={(e) => set('sleepHours', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="مستوى النشاط اليومي خارج التمرين">
              <Select value={d.dailyActivityLevel ?? ''} onChange={(e) => set('dailyActivityLevel', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Toggle
                checked={d.hasDoubleTraining}
                onChange={(v) => set('hasDoubleTraining', v)}
                label="تدريب صباحي ومسائي في اليوم نفسه"
                description="سيتضمن النظام توصيات خاصة بالتدريب المزدوج"
              />
            </div>
          </div>
        </Card>
      )}

      {/* ============ الغذاء والصحة ============ */}
      {tab === 'nutrition' && (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ocean-900">الحالة الغذائية والصحية</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الهدف">
              <Select value={d.goal ?? ''} onChange={(e) => set('goal', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="النظام الغذائي">
              <Select value={d.dietType ?? ''} onChange={(e) => set('dietType', e.target.value)}>
                <option value="">— اختر —</option>
                {Object.entries(DIET_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="عدد الوجبات المفضلة يوميًا">
              <Input type="number" min={2} max={8} value={numberOrEmpty(d.preferredMealsPerDay)} onChange={(e) => set('preferredMealsPerDay', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="الميزانية الغذائية التقريبية">
              <Select value={d.budgetLevel ?? ''} onChange={(e) => set('budgetLevel', e.target.value)}>
                <option value="">— اختر —</option>
                <option value="low">اقتصادية</option>
                <option value="medium">متوسطة</option>
                <option value="high">مرتفعة</option>
              </Select>
            </Field>
            <Field label="الحساسية الغذائية">
              <Textarea value={d.allergies ?? ''} placeholder="مثال: فول سوداني، مأكولات بحرية" onChange={(e) => set('allergies', e.target.value)} />
            </Field>
            <Field label="الأطعمة غير المرغوبة">
              <Textarea value={d.dislikedFoods ?? ''} placeholder="أطعمة لا يفضلها السباح" onChange={(e) => set('dislikedFoods', e.target.value)} />
            </Field>
            <Field label="الأطعمة المتاحة في الدولة">
              <Textarea value={d.availableFoods ?? ''} placeholder="الأطعمة المتوفرة محليًا بسهولة" onChange={(e) => set('availableFoods', e.target.value)} />
            </Field>
            <Field label="الأمراض المزمنة / الحالات الصحية">
              <Textarea value={d.chronicConditions ?? ''} placeholder="إن وجدت — مهمة للتنبيه الطبي" onChange={(e) => set('chronicConditions', e.target.value)} />
            </Field>
            <Field label="الأدوية المستخدمة">
              <Textarea value={d.medications ?? ''} placeholder="الأدوية الحالية إن وجدت" onChange={(e) => set('medications', e.target.value)} />
            </Field>
            <Field label="الإصابات الحالية">
              <Textarea value={d.currentInjuries ?? ''} onChange={(e) => set('currentInjuries', e.target.value)} />
            </Field>
            <Field label="مشكلات الجهاز الهضمي">
              <Textarea value={d.digestiveIssues ?? ''} onChange={(e) => set('digestiveIssues', e.target.value)} />
            </Field>
            <Field label="حالة الحمل أو الرضاعة — عند الحاجة">
              <Select value={d.pregnancyStatus ?? ''} onChange={(e) => set('pregnancyStatus', e.target.value)}>
                <option value="">لا ينطبق</option>
                <option value="pregnant">حامل</option>
                <option value="lactating">مرضع</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 space-y-4">
              <Toggle
                checked={d.isMinor}
                onChange={(v) => set('isMinor', v)}
                label="السباح أقل من 18 عامًا (قاصر)"
                description="يتطلب إدخال بيانات ولي الأمر وتفعيل الموافقة"
              />
              {d.isMinor && (
                <div className="grid gap-4 rounded-xl bg-ocean-50 p-4 sm:grid-cols-2">
                  <Field label="اسم ولي الأمر" required>
                    <Input value={d.guardianName ?? ''} onChange={(e) => set('guardianName', e.target.value)} />
                  </Field>
                  <Field label="هاتف ولي الأمر" required>
                    <Input dir="ltr" value={d.guardianPhone ?? ''} onChange={(e) => set('guardianPhone', e.target.value)} />
                  </Field>
                </div>
              )}
              <Field label="ملاحظات إضافية">
                <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {medicalAlert?.on && <Badge color="red">يتطلب مراجعة طبية — خطة إرشادية فقط</Badge>}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={saveAndFinish} loading={saving} disabled={!d.fullName?.trim()}>
            <Check className="h-4 w-4" />
            حفظ البيانات
          </Button>
          <Button onClick={saveAndFinish} loading={saving} disabled={!d.fullName?.trim()}>
            <Calculator className="h-4 w-4" />
            حفظ ثم احسب احتياجاتي
          </Button>
        </div>
      </div>
    </div>
  );
}
