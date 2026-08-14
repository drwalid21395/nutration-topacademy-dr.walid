/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/components/supplements/supplements-calculator.tsx

وظيفة الملف:
"حاسبة المكملات الذكية" — أكبر صفحة في التطبيق، تقوم بـ:
1) جمع بيانات الرياضي (عمر، وزن، هدف، تدريب، أدوية، تحاليل، منتجات).
2) مقارنة الاحتياجات الغذائية بمتوسط المدخول الفعلي لكشف الفجوات.
3) تقييم كل مكمل/منتج (بعد إقرار إلزامي) وإنتاج:
   - تغطية الاحتياجات من الطعام + تحذيرات الحدود العليا.
   - فجوة البروتين مع بدائل غذائية أولًا.
   - الترطيب والكهرل، وتوصيات المكملات المفحوصة.
   - فحص الأهلية والسلامة (تسجل الأدوية والتحاليل لتفادي التداخلات).
   - جدول مقترح للجرعات، وبدائل غذائية، وإخلاء مسؤولية.
4) حفظ التقييم لمراجعة مختص (أخصائي تغذية/كوتش/أدمن) مع اعتماد/رفض.
5) سجل تعاطٍ يومي لتتبع الالتزام والأعراض الجانبية.

لماذا نحتاجه؟
نظام آمن يرفض إعطاء مكملات دون بيانات: لا حديد/فيتامين د دون تحليل،
لا قاصر دون موافقة ولي الأمر، ولا نتيجة دون إقرار — والغذاء أولًا دائمًا.

'use client':
يعمل في المتصفح لأنه تفاعلي بالكامل (نماذج، نوافذ، fetch).

متى يعمل؟
عند فتح /supplements/calculator.

من يستدعي هذا الملف؟
src/app/supplements/calculator/page.tsx.

الملفات التي يتعامل معها:
- API: /api/supplements/context (السياق)، /calculate، /assessments (+ PDF),
  /approve، /products، /medications، /lab-results، /intake.
- services/supplements/types (أنواع الإدخال والإخراج).
- مكوّنات: ui (Card/Alert/Badge/Stat/ProgressBar/Spinner/Modal/EmptyState)،
  ui/button، ui/forms.
- lib/constants (نصوص الإقرار والتنبيه والعلامة التجارية).

ترتيب العمل:
1. تحميل السياق: الملف، الاحتياجات، المنتجات، الأدوية، التحاليل ↓
2. تعديل البيانات وملء متوسط المدخول ↓
3. الموافقة على الإقرار الإلزامي ↓
4. "احسب التقييم" → POST /calculate → عرض النتائج ↓
5. حفظ التقييم (مع PDF) لمراجعة المختص ↓
6. المختص يعتمد/يرفض من نافذة الموافقات
==================================================
*/

'use client';

// ========================================
// 1. الاستيرادات
// ========================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
// أيقونات الأقسام والنماذج.
import {
  Calculator, FlaskConical, Pill, Package, CheckCircle2, XCircle, AlertTriangle,
  Save, RotateCcw, Calendar, Droplets, Beef, ClipboardList, ShieldCheck, FileDown,
} from 'lucide-react';
import { Card, CardHeader, Alert, Badge, Stat, ProgressBar, Spinner, Modal, EmptyState } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Field, Toggle } from '@/components/ui/forms';
import type { SupplementAssessmentInput, SupplementAssessmentOutput } from '@/services/supplements/types';
import { SUPPLEMENT_ACK_TEXT, SUPPLEMENT_DISCLAIMER, SUPPLEMENT_BRANDING } from '@/lib/constants';

// ========================================
// 2. أنواع البيانات القادمة من السياق
// ========================================

type CtxProduct = { id: string; name: string; brand?: string | null; ingredientsJson?: string | null; thirdPartyTested: boolean; dopingRisk: string };
type CtxMed = { id: string; name: string; purpose?: string | null; dosage?: string | null; frequency?: string | null };
type CtxLab = { id: string; marker: string; markerAr?: string | null; value: number; unit: string; referenceRange?: string | null; testDate: string };
type CtxAssessment = Record<string, unknown> & { id: string; status: string; overallLevel: string; createdAt: string; approvals?: { id: string; action: string; approver: { name: string; role: string } }[] };

// ========================================
// 3. قوائم الاختيار الجاهزة
// ========================================

// LAB_MARKERS: التحاليل المخبرية المتاحة للإدخال.
const LAB_MARKERS = [
  { value: 'hemoglobin', label: 'الهيموجلوبين' },
  { value: 'ferritin', label: 'فيريتين' },
  { value: 'iron', label: 'حديد' },
  { value: 'transferrin', label: 'ترانسفيرين' },
  { value: 'vitaminD', label: 'فيتامين د (25-OH)' },
  { value: 'b12', label: 'فيتامين ب12' },
  { value: 'folate', label: 'حمض الفوليك' },
  { value: 'calcium', label: 'كالسيوم' },
  { value: 'magnesium', label: 'مغنيسيوم' },
  { value: 'zinc', label: 'زنك' },
  { value: 'kidney', label: 'وظائف كلى' },
  { value: 'liver', label: 'وظائف كبد' },
  { value: 'thyroid', label: 'الغدة الدرقية' },
  { value: 'glucose', label: 'سكر الصائم' },
];

// DOPING_OPTIONS: مستويات خطر المنشطات للمنتج.
const DOPING_OPTIONS = [
  { value: 'none', label: 'لا خطر' },
  { value: 'low', label: 'منخفض' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'مرتفع' },
  { value: 'prohibited', label: 'محظور' },
  { value: 'unknown', label: 'غير معروف' },
];

// INTENSITIES: شدّة التدريب.
const INTENSITIES = [
  { value: 'low', label: 'منخفضة' },
  { value: 'moderate', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
  { value: 'veryHigh', label: 'عالية جدًا' },
];

// GOALS: أهداف الرياضي.
const GOALS = [
  { value: 'maintenance', label: 'تثبيت' },
  { value: 'fatLoss', label: 'خفض دهون' },
  { value: 'muscleGain', label: 'زيادة عضل' },
  { value: 'endurance', label: 'تحمل' },
  { value: 'recovery', label: 'استشفاء' },
  { value: 'competition', label: 'منافسة' },
  { value: 'weightGain', label: 'زيادة وزن' },
];

// ========================================
// 4. دوال مساعدة
// ========================================

// num: تحويل أي قيمة نصية إلى رقم (والفارغ/غير الصحيح → 0).
function num(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

// statusColor: لون شارة حالة التوصية (غذاء أولًا=أخضر، ممنوع=أحمر).
function statusColor(status: string): 'green' | 'red' | 'ocean' {
  if (status === 'food-first') return 'green';
  if (status === 'blocked') return 'red';
  return 'ocean';
}

// coverageBarClass: لون شريط التغطية حسب النسبة المئوية.
function coverageBarClass(pct: number): 'green' | 'red' | 'gold' | 'ocean' {
  if (pct < 70) return 'red';
  if (pct < 90) return 'gold';
  if (pct > 110) return 'gold';
  return 'green';
}

// ========================================
// 5. المكوّن الرئيسي: SupplementsCalculator
// ========================================

export function SupplementsCalculator() {
  // boot: أثناء تحميل السياق نعرض Spinner.
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // userRole: دور المستخدم — يحدد صلاحية الاعتماد.
  const [userRole, setUserRole] = useState('athlete');

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [targets, setTargets] = useState<Record<string, unknown> | null>(null);
  const [products, setProducts] = useState<CtxProduct[]>([]);
  const [medications, setMedications] = useState<CtxMed[]>([]);
  const [labResults, setLabResults] = useState<CtxLab[]>([]);
  const [assessments, setAssessments] = useState<CtxAssessment[]>([]);

  // حقول التقييم
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [goal, setGoal] = useState('competition');
  const [dietType, setDietType] = useState('regular');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [digestiveIssues, setDigestiveIssues] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('none');
  const [swimSessions, setSwimSessions] = useState('');
  const [swimMinutes, setSwimMinutes] = useState('');
  const [intensity, setIntensity] = useState('high');
  const [doubleTraining, setDoubleTraining] = useState(false);
  const [sleepHours, setSleepHours] = useState('');
  const [nextCompetitionDate, setNextCompetitionDate] = useState('');
  const [competitionMode, setCompetitionMode] = useState(false);

  // الاحتياجات والمدخول
  const [calTarget, setCalTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');
  const [carbsTarget, setCarbsTarget] = useState('');
  const [fatTarget, setFatTarget] = useState('');
  const [fiberTarget, setFiberTarget] = useState('');
  const [waterTarget, setWaterTarget] = useState('');
  const [trainingWater, setTrainingWater] = useState('');
  const [sodiumTarget, setSodiumTarget] = useState('');
  const [avgCal, setAvgCal] = useState('');
  const [avgProtein, setAvgProtein] = useState('');
  const [avgCarbs, setAvgCarbs] = useState('');
  const [avgFat, setAvgFat] = useState('');
  const [avgFiber, setAvgFiber] = useState('');
  const [avgSodium, setAvgSodium] = useState('');
  const [avgWater, setAvgWater] = useState('');

  // النتيجة: نتيجة التقييم + حالات الحساب والحفظ.
  const [result, setResult] = useState<SupplementAssessmentOutput | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // نماذج الإضافة
  const [showProductForm, setShowProductForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [ingredients, setIngredients] = useState<{ name: string; amount: string; unit: string }[]>([{ name: '', amount: '', unit: 'g' }]);
  const [newProduct, setNewProduct] = useState({ name: '', brand: '', thirdPartyTested: false, dopingRisk: 'unknown', dailyDose: '', notes: '' });
  const [newMed, setNewMed] = useState({ name: '', purpose: '', dosage: '', frequency: '' });
  const [newLab, setNewLab] = useState({ marker: 'ferritin', value: '', unit: '', referenceRange: '', testDate: '' });

  // سجل التعاطي
  const [intakeLogs, setIntakeLogs] = useState<Record<string, unknown>[]>([]);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [newLog, setNewLog] = useState({ supplementName: '', doseAmount: '', doseUnit: 'g', withFood: true, compliant: true, sideEffects: '', energyLevel: '', recoveryLevel: '' });

  // نافذة الموافقات
  const [approveTarget, setApproveTarget] = useState<CtxAssessment | null>(null);
  const [approveAction, setApproveAction] = useState('approved');
  const [approveNotes, setApproveNotes] = useState('');

  // load: تحميل كل سياق الحساب (الملف، الاحتياجات، المنتجات، الأدوية، التحاليل)
  // وتعبئة حقول النموذج من البيانات المحفوظة.
  const load = useCallback(async () => {
    const res = await fetch('/api/supplements/context');
    if (!res.ok) {
      setError('تعذر تحميل بيانات حسابك. تأكد من تسجيل الدخول.');
      setBoot(false);
      return;
    }
    const data = await res.json();
    setUserRole(data.user?.role ?? 'athlete');
    const p = data.profile;
    setProfile(p);
    setTargets(data.targets);
    setProducts(data.products ?? []);
    setMedications(data.medications ?? []);
    setLabResults(data.labResults ?? []);
    setAssessments(data.latestAssessment ? [data.latestAssessment] : []);

    if (p) {
      setIsMinor(!!p.isMinor);
      setAge(p.age != null ? String(p.age) : '');
      setGender(p.gender ?? 'male');
      setWeightKg(p.weightKg != null ? String(p.weightKg) : '');
      setHeightCm(p.heightCm != null ? String(p.heightCm) : '');
      setBodyFat(p.bodyFatPercent != null ? String(p.bodyFatPercent) : '');
      setGoal(p.goal ?? 'competition');
      setDietType(p.dietType ?? 'regular');
      setAllergies(p.allergies ?? '');
      setChronicConditions(p.chronicConditions ?? '');
      setDigestiveIssues(p.digestiveIssues ?? '');
      setPregnancyStatus(p.pregnancyStatus ?? 'none');
      setSwimSessions(p.swimSessionsPerWeek != null ? String(p.swimSessionsPerWeek) : '');
      setSwimMinutes(p.swimMinutesPerSession != null ? String(p.swimMinutesPerSession) : '');
      setIntensity(p.trainingIntensity ?? 'high');
      setDoubleTraining(!!p.hasDoubleTraining);
      setSleepHours(p.sleepHours != null ? String(p.sleepHours) : '');
      setNextCompetitionDate(p.nextCompetitionDate ? String(p.nextCompetitionDate).slice(0, 10) : '');
      setCompetitionMode(!!p.nextCompetitionDate);
    }
    const t = data.targets;
    if (t) {
      setCalTarget(t.calories != null ? String(t.calories) : '');
      setProteinTarget(t.proteinG != null ? String(t.proteinG) : '');
      setCarbsTarget(t.carbsG != null ? String(t.carbsG) : '');
      setFatTarget(t.fatG != null ? String(t.fatG) : '');
      setFiberTarget(t.fiberG != null ? String(t.fiberG) : '');
      setWaterTarget(t.waterMl != null ? String(t.waterMl) : '');
      setTrainingWater(t.trainingWaterMl != null ? String(t.trainingWaterMl) : '');
      setSodiumTarget(t.sodiumMg != null ? String(t.sodiumMg) : '');
    }
    setBoot(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const profileMedicationNames = useMemo(() => medications.map((m) => m.name), [medications]);

  const buildInput = (): SupplementAssessmentInput => ({
    profileId: (profile?.id as string) ?? null,
    isMinor,
    guardianConsent,
    age: num(age) || null,
    gender: gender || null,
    weightKg: num(weightKg) || null,
    heightCm: num(heightCm) || null,
    bodyFatPercent: num(bodyFat) || null,
    goal: goal || null,
    dietType: dietType || null,
    allergies: allergies || null,
    chronicConditions: chronicConditions || null,
    medications: null,
    digestiveIssues: digestiveIssues || null,
    pregnancyStatus: pregnancyStatus || null,
    swimSessionsPerWeek: num(swimSessions) || null,
    swimMinutesPerSession: num(swimMinutes) || null,
    trainingIntensity: intensity || null,
    hasDoubleTraining: doubleTraining,
    sleepHours: num(sleepHours) || null,
    nextCompetitionDate: nextCompetitionDate ? new Date(nextCompetitionDate).toISOString() : null,
    competitionMode,
    dailyCaloriesTarget: num(calTarget) || null,
    proteinTarget: num(proteinTarget) || null,
    carbsTarget: num(carbsTarget) || null,
    fatTarget: num(fatTarget) || null,
    fiberTarget: num(fiberTarget) || null,
    waterTarget: num(waterTarget) || null,
    trainingWaterMl: num(trainingWater) || null,
    sodiumTarget: num(sodiumTarget) || null,
    avgFoodCalories: num(avgCal),
    avgFoodProteinG: num(avgProtein),
    avgFoodCarbsG: num(avgCarbs),
    avgFoodFatG: num(avgFat),
    avgFoodFiberG: num(avgFiber),
    avgFoodSodiumMg: num(avgSodium),
    avgWaterMl: num(avgWater),
    products: products.map((p) => ({
      name: p.name,
      ingredients: parseIngredientJson(p.ingredientsJson),
    })),
    medicationsList: profileMedicationNames,
    labResults: labResults.map((l) => ({
      marker: l.marker,
      markerAr: l.markerAr ?? l.marker,
      value: num(l.value),
      unit: l.unit,
      referenceRange: l.referenceRange ?? null,
    })),
  });

  // runCalculation: تشغيل التقييم — يمنع العرض قبل الموافقة على الإقرار.
  const runCalculation = async () => {
    if (!ackConfirmed) {
      setError('يجب قراءة الإقرار والموافقة عليه قبل عرض نتيجة التقييم.');
      return;
    }
    setCalculating(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/supplements/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInput()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'تعذر إكمال التقييم');
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء التقييم');
    } finally {
      setCalculating(false);
    }
  };

  // saveAssessment: حفظ التقييم في الخادم ثم تنزيل تقريره PDF تلقائيًا.
  const saveAssessment = async () => {
    if (!result) return;
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/supplements/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile?.id ?? null, result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'تعذر الحفظ');
      const id = data.assessment?.id as string | undefined;
      setSavedMsg('تم حفظ التقييم — جارٍ تحميل تقرير PDF لعرضه على المختص.');
      await load();
      if (id) {
        const pdfRes = await fetch(`/api/supplements/assessments/${id}/pdf`);
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `supplement-assessment-${id}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim()) return;
    const res = await fetch('/api/supplements/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProduct.name,
        brand: newProduct.brand,
        ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: num(i.amount), unit: i.unit })),
        thirdPartyTested: newProduct.thirdPartyTested,
        dopingRisk: newProduct.dopingRisk,
        dailyDose: newProduct.dailyDose,
        notes: newProduct.notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر إضافة المنتج');
      return;
    }
    setShowProductForm(false);
    setNewProduct({ name: '', brand: '', thirdPartyTested: false, dopingRisk: 'unknown', dailyDose: '', notes: '' });
    setIngredients([{ name: '', amount: '', unit: 'g' }]);
    await load();
  };

  const deleteProduct = async (id: string) => {
    await fetch(`/api/supplements/products?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const addMed = async () => {
    if (!newMed.name.trim()) return;
    const res = await fetch('/api/supplements/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMed),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر إضافة الدواء');
      return;
    }
    setShowMedForm(false);
    setNewMed({ name: '', purpose: '', dosage: '', frequency: '' });
    await load();
  };

  const deleteMed = async (id: string) => {
    await fetch(`/api/supplements/medications?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const addLab = async () => {
    if (!newLab.value) return;
    const marker = LAB_MARKERS.find((m) => m.value === newLab.marker);
    const res = await fetch('/api/supplements/lab-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marker: newLab.marker, markerAr: marker?.label, value: num(newLab.value), unit: newLab.unit || '—', referenceRange: newLab.referenceRange, testDate: newLab.testDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر إضافة التحليل');
      return;
    }
    setShowLabForm(false);
    setNewLab({ marker: 'ferritin', value: '', unit: '', referenceRange: '', testDate: '' });
    await load();
  };

  const deleteLab = async (id: string) => {
    await fetch(`/api/supplements/lab-results?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const addLog = async () => {
    if (!newLog.supplementName.trim() || !newLog.doseAmount) return;
    const res = await fetch('/api/supplements/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplementName: newLog.supplementName,
        doseAmount: num(newLog.doseAmount),
        doseUnit: newLog.doseUnit,
        withFood: newLog.withFood,
        compliant: newLog.compliant,
        sideEffects: newLog.sideEffects,
        energyLevel: newLog.energyLevel ? num(newLog.energyLevel) : null,
        recoveryLevel: newLog.recoveryLevel ? num(newLog.recoveryLevel) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر تسجيل التعاطي');
      return;
    }
    setShowIntakeForm(false);
    setNewLog({ supplementName: '', doseAmount: '', doseUnit: 'g', withFood: true, compliant: true, sideEffects: '', energyLevel: '', recoveryLevel: '' });
    await loadIntake();
  };

  const loadIntake = async () => {
    const res = await fetch('/api/supplements/intake');
    if (res.ok) {
      const data = await res.json();
      setIntakeLogs(data.logs ?? []);
    }
  };

  useEffect(() => {
    loadIntake();
  }, []);

  const approve = async (assessmentId: string) => {
    const res = await fetch('/api/supplements/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, action: approveAction, notes: approveNotes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'تعذر الاعتماد');
      return;
    }
    setApproveTarget(null);
    setApproveNotes('');
    await load();
  };

  // أثناء تحميل السياق: مؤشر تحميل فقط.
  if (boot) return <Spinner label="جارٍ تحميل حاسبة المكملات…" />;

  // canApprove: هل يستطيع المستخدم اعتماد التقييمات؟ (المختصون فقط).
  const canApprove = ['dietitian', 'coach', 'admin'].includes(userRole);

  return (
    <div className="space-y-8">
      {/* ترويسة الصفحة */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-ocean-900">حاسبة المكملات الذكية</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
          تحليل تغذوي استرشادي يربط احتياجاتك الغذائية وتدريبك وتحاليلك بقرار المكملات — الغذاء الطبيعي أولًا،
          والنتائج لا تُعد وصفات علاجية ولا تحل محل استشارة المختص.
        </p>
      </div>

      {/* التنبيهات العامة */}
      {error && <Alert variant="danger" title="تنبيه">{error}</Alert>}
      {savedMsg && <Alert variant="success" title="تم بنجاح">{savedMsg}</Alert>}
      {isMinor && (
        <Alert variant="warning" title="مستخدم قاصر (أقل من 18 سنة)">
          تقييمك محجوب جزئيًا تلقائيًا: المكملات المناسبة للقاصرين فقط تُدرس، وتتطلب موافقة ولي الأمر وإشراف مختص قبل البدء.
        </Alert>
      )}

      {/* بيانات الرياضي */}
      <Card>
        <CardHeader
          icon={<Calculator className="h-5 w-5" />}
          title="بيانات الرياضي والتدريب"
          subtitle="تُعبأ تلقائيًا من ملفك، ويمكنك تعديلها"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="العمر">
            <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="مثال: 17" />
          </Field>
          <Field label="الجنس">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </Select>
          </Field>
          <Field label="الوزن (كجم)">
            <Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="مثال: 70" />
          </Field>
          <Field label="الطول (سم)">
            <Input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="مثال: 178" />
          </Field>
          <Field label="نسبة الدهون (اختياري)">
            <Input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="مثال: 12" />
          </Field>
          <Field label="الهدف">
            <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
          </Field>
          <Field label="نظام الغذاء">
            <Select value={dietType} onChange={(e) => setDietType(e.target.value)}>
              <option value="regular">عادي</option>
              <option value="vegetarian">نباتي</option>
              <option value="semiVegetarian">شبه نباتي</option>
              <option value="glutenFree">خالٍ من الغلوتين</option>
              <option value="lactoseFree">خالٍ من اللاكتوز</option>
            </Select>
          </Field>
          <Field label="شدة التدريب">
            <Select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
              {INTENSITIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </Select>
          </Field>
          <Field label="جلسات السباحة أسبوعيًا">
            <Input type="number" value={swimSessions} onChange={(e) => setSwimSessions(e.target.value)} placeholder="مثال: 6" />
          </Field>
          <Field label="دقائق الجلسة">
            <Input type="number" value={swimMinutes} onChange={(e) => setSwimMinutes(e.target.value)} placeholder="مثال: 120" />
          </Field>
          <Field label="ساعات النوم">
            <Input type="number" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="مثال: 8" />
          </Field>
          <Field label="تاريخ البطولة القادمة (اختياري)">
            <Input type="date" value={nextCompetitionDate} onChange={(e) => setNextCompetitionDate(e.target.value)} />
          </Field>
          <Field label="الحالة الصحية (أمراض مزمنة)">
            <Input value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} placeholder="مثال: ربو خفيف" />
          </Field>
          <Field label="حساسية">
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="مثال: حليب، فول سوداني" />
          </Field>
          <Field label="مشاكل هضمية">
            <Input value={digestiveIssues} onChange={(e) => setDigestiveIssues(e.target.value)} placeholder="مثال: لا" />
          </Field>
          <Field label="الحمل/الرضاعة">
            <Select value={pregnancyStatus} onChange={(e) => setPregnancyStatus(e.target.value)}>
              <option value="none">لا</option>
              <option value="pregnant">حمل</option>
              <option value="lactating">رضاعة</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle checked={doubleTraining} onChange={setDoubleTraining} label="تدريب مزدوج (مرتين يوميًا)" />
          <Toggle checked={competitionMode} onChange={setCompetitionMode} label="في موسم بطولة" description="يؤثر على تحذيرات المنافسة ومكافحة المنشطات" />
        </div>
        {isMinor && (
          <div className="mt-4">
            <Toggle
              checked={guardianConsent}
              onChange={setGuardianConsent}
              label="موافقة ولي الأمر"
              description="أقر بأن لدي موافقة ولي الأمر على تقييم المكملات"
            />
          </div>
        )}
      </Card>

      {/* الاحتياجات والمدخول */}
      <Card>
        <CardHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="الاحتياجات اليومية ومتوسط المدخول من الطعام"
          subtitle="الاحتياجات تُعبأ من الحاسبة الغذائية — أدخل متوسط طعامك الفعلي للكشف عن الفجوات"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="احتياج السعرات">
            <Input type="number" value={calTarget} onChange={(e) => setCalTarget(e.target.value)} />
          </Field>
          <Field label="احتياج البروتين (جم)">
            <Input type="number" value={proteinTarget} onChange={(e) => setProteinTarget(e.target.value)} />
          </Field>
          <Field label="احتياج الكربوهيدرات (جم)">
            <Input type="number" value={carbsTarget} onChange={(e) => setCarbsTarget(e.target.value)} />
          </Field>
          <Field label="احتياج الدهون (جم)">
            <Input type="number" value={fatTarget} onChange={(e) => setFatTarget(e.target.value)} />
          </Field>
          <Field label="احتياج الألياف (جم)">
            <Input type="number" value={fiberTarget} onChange={(e) => setFiberTarget(e.target.value)} />
          </Field>
          <Field label="احتياج الماء (مل)">
            <Input type="number" value={waterTarget} onChange={(e) => setWaterTarget(e.target.value)} />
          </Field>
          <Field label="ماء إضافي أثناء التدريب (مل)">
            <Input type="number" value={trainingWater} onChange={(e) => setTrainingWater(e.target.value)} />
          </Field>
          <Field label="حد الصوديوم اليومي (ملجم)">
            <Input type="number" value={sodiumTarget} onChange={(e) => setSodiumTarget(e.target.value)} />
          </Field>
        </div>
        <p className="label mt-6">متوسط المدخول الفعلي من الطعام يوميًا</p>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="سعرات (سعرة)">
            <Input type="number" value={avgCal} onChange={(e) => setAvgCal(e.target.value)} placeholder="0" />
          </Field>
          <Field label="بروتين (جم)">
            <Input type="number" value={avgProtein} onChange={(e) => setAvgProtein(e.target.value)} placeholder="0" />
          </Field>
          <Field label="كربوهيدرات (جم)">
            <Input type="number" value={avgCarbs} onChange={(e) => setAvgCarbs(e.target.value)} placeholder="0" />
          </Field>
          <Field label="دهون (جم)">
            <Input type="number" value={avgFat} onChange={(e) => setAvgFat(e.target.value)} placeholder="0" />
          </Field>
          <Field label="ألياف (جم)">
            <Input type="number" value={avgFiber} onChange={(e) => setAvgFiber(e.target.value)} placeholder="0" />
          </Field>
          <Field label="صوديوم (ملجم)">
            <Input type="number" value={avgSodium} onChange={(e) => setAvgSodium(e.target.value)} placeholder="0" />
          </Field>
          <Field label="ماء (مل)">
            <Input type="number" value={avgWater} onChange={(e) => setAvgWater(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </Card>

      {/* المنتجات */}
      <Card>
        <CardHeader
          icon={<Package className="h-5 w-5" />}
          title="المكملات/المنتجات المتوفرة لديك"
          subtitle="تُفحص مكوناتها ضد الحدود العليا والتداخلات"
          action={<Button size="sm" onClick={() => setShowProductForm(true)}>+ إضافة منتج</Button>}
        />
        {products.length === 0 ? (
          <EmptyState icon={<Package className="h-10 w-10" />} title="لا توجد منتجات" description="أضف منتجاتك الحالية (اسم، مكونات، تحليل جهة خارجية) لفحصها في التقييم." />
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{p.name} {p.brand ? <span className="font-normal text-slate-500">— {p.brand}</span> : null}</p>
                  <p className="text-xs text-slate-500">
                    {p.thirdPartyTested ? <Badge color="green" className="ml-2">تحليل خارجي</Badge> : null}
                    <Badge color={p.dopingRisk === 'none' || p.dopingRisk === 'low' ? 'green' : 'red'} className="ml-2">خطر منشطات: {DOPING_OPTIONS.find((d) => d.value === p.dopingRisk)?.label ?? p.dopingRisk}</Badge>
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteProduct(p.id)}>حذف</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* الأدوية */}
      <Card>
        <CardHeader
          icon={<Pill className="h-5 w-5" />}
          title="الأدوية الحالية"
          subtitle="تُستخدم لكشف التداخلات المحتملة مع المكملات"
          action={<Button size="sm" onClick={() => setShowMedForm(true)}>+ إضافة دواء</Button>}
        />
        {medications.length === 0 ? (
          <EmptyState icon={<Pill className="h-10 w-10" />} title="لا توجد أدوية" description="أضف أدويتك الحالية (خاصة طويلة الأمد) لتفادي التداخلات." />
        ) : (
          <div className="space-y-2">
            {medications.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">{m.name}</p>
                  {m.purpose && <p className="text-xs text-slate-500">{m.purpose} {m.dosage ? `· ${m.dosage}` : ''}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteMed(m.id)}>حذف</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* التحاليل */}
      <Card>
        <CardHeader
          icon={<FlaskConical className="h-5 w-5" />}
          title="التحاليل المخبرية"
          subtitle="تُستخدم فقط عند وجود نقص مثبت — لا يعطى الحديد/فيتامين د دون تحليل"
          action={<Button size="sm" onClick={() => setShowLabForm(true)}>+ إضافة تحليل</Button>}
        />
        {labResults.length === 0 ? (
          <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="لا توجد تحاليل" description="أضف تحاليل حديثة (فيريتين، فيتامين د، ب12…) للحصول على تقييم أدق." />
        ) : (
          <div className="space-y-2">
            {labResults.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">{l.markerAr ?? l.marker}</p>
                  <p className="text-xs text-slate-500">القيمة {l.value} {l.unit} {l.referenceRange ? `· المدى المرجعي ${l.referenceRange}` : ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteLab(l.id)}>حذف</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* الإقرار الإلزامي قبل عرض النتيجة */}
      <div className="rounded-2xl border-2 border-ocean-200 bg-ocean-50/70 p-4">
        <p className="text-sm font-bold text-ocean-900">إقرار قبل عرض النتيجة</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{SUPPLEMENT_ACK_TEXT}</p>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={ackConfirmed}
            onChange={(e) => setAckConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-ocean-600"
          />
          <span className="text-sm font-semibold text-ocean-900">
            قرأت الإقرار وأوافق على متابعة عرض النتيجة.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" loading={calculating} onClick={runCalculation}>
          <Calculator className="h-5 w-5" /> احسب التقييم
        </Button>
        <Button size="lg" variant="secondary" onClick={() => { setResult(null); setError(null); setSavedMsg(null); setAckConfirmed(false); }}>
          <RotateCcw className="h-4 w-4" /> تصفير
        </Button>
      </div>

      {/* النتائج */}
      {result && <ResultsView result={result} />}

      {result && (
        <div className="flex justify-center">
          <Button variant="gold" loading={saving} onClick={saveAssessment}>
            <Save className="h-5 w-5" /> حفظ التقييم لمراجعة المختص
          </Button>
        </div>
      )}

      {/* سجل التعاطي */}
      <Card>
        <CardHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="سجل التعاطي والمتابعة"
          subtitle="سجّل جرعاتك ومدى الالتزام وأي أعراض جانبية"
          action={<Button size="sm" onClick={() => setShowIntakeForm(true)}>+ تسجيل تعاطٍ</Button>}
        />
        {intakeLogs.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="لا توجد سجلات" description="سجّل جرعاتك اليومية لتتبع الالتزام والآثار." />
        ) : (
          <div className="space-y-2">
            {intakeLogs.map((l) => (
              <div key={l.id as string} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">{l.supplementName as string}</p>
                  <p className="text-xs text-slate-500">
                    {(l.doseAmount as number)} {(l.doseUnit as string)}
                    {(l.timeTaken as string) ? ` · ${new Date(l.timeTaken as string).toLocaleDateString('ar-EG')}` : ''}
                    {l.sideEffects ? ` · أعراض: ${l.sideEffects as string}` : ''}
                  </p>
                </div>
                <Badge color={l.compliant ? 'green' : 'red'}>{l.compliant ? 'ملتزم' : 'غير ملتزم'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* الموافقات والتقييمات المحفوظة */}
      {assessments.length > 0 && (
        <Card>
          <CardHeader icon={<ShieldCheck className="h-5 w-5" />} title="التقييمات المحفوظة" subtitle={canApprove ? 'يمكنك مراجعة واعتماد التقييمات' : 'يمكنك تحميل تقرير أي تقييم PDF'} />
          <div className="space-y-3">
            {assessments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">تقييم {new Date(a.createdAt).toLocaleDateString('ar-EG')}</p>
                  <p className="text-xs text-slate-500">
                    الحالة: <Badge color={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'ocean'}>{a.status}</Badge>
                    <span className="mx-2">المستوى: {a.overallLevel}</span>
                  </p>
                  {a.approvals?.map((ap) => (
                    <p key={ap.id} className="text-xs text-slate-500">{ap.approver.name}: {ap.action}</p>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/supplements/assessments/${a.id}/pdf`} className="btn-secondary" target="_blank" rel="noreferrer">
                    <FileDown className="h-4 w-4" /> PDF
                  </a>
                  {canApprove && a.status === 'needs-review' && (
                    <Button size="sm" onClick={() => setApproveTarget(a)}>مراجعة</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* نوافذ النماذج */}
      <Modal open={showProductForm} onClose={() => setShowProductForm(false)} title="إضافة منتج مكمل">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="اسم المنتج" required><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></Field>
            <Field label="الشركة المصنعة"><Input value={newProduct.brand} onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })} /></Field>
          </div>
          <p className="label">المكونات النشطة (الجرعة في الحصة)</p>
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1"><Input placeholder="اسم المكون (مثال: كرياتين)" value={ing.name} onChange={(e) => setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} /></div>
              <div className="w-24"><Input type="number" placeholder="الكمية" value={ing.amount} onChange={(e) => setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} /></div>
              <div className="w-20">
                <Select value={ing.unit} onChange={(e) => setIngredients(ingredients.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))}>
                  <option value="g">جم</option>
                  <option value="mg">ملجم</option>
                  <option value="IU">IU</option>
                  <option value="mcg">مكجم</option>
                </Select>
              </div>
              {ingredients.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}>حذف</Button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setIngredients([...ingredients, { name: '', amount: '', unit: 'g' }])}>+ مكوّن</Button>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="خطر المنشطات">
              <Select value={newProduct.dopingRisk} onChange={(e) => setNewProduct({ ...newProduct, dopingRisk: e.target.value })}>
                {DOPING_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label="الجرعة اليومية المقترحة"><Input value={newProduct.dailyDose} onChange={(e) => setNewProduct({ ...newProduct, dailyDose: e.target.value })} /></Field>
          </div>
          <Field label="ملاحظات"><Textarea value={newProduct.notes} onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })} /></Field>
          <Toggle checked={newProduct.thirdPartyTested} onChange={(v) => setNewProduct({ ...newProduct, thirdPartyTested: v })} label="مختبَر بتحليل جهة خارجية" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowProductForm(false)}>إلغاء</Button>
            <Button onClick={addProduct}>حفظ المنتج</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showMedForm} onClose={() => setShowMedForm(false)} title="إضافة دواء">
        <div className="space-y-4">
          <Field label="اسم الدواء" required><Input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} /></Field>
          <Field label="الغرض"><Input value={newMed.purpose} onChange={(e) => setNewMed({ ...newMed, purpose: e.target.value })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="الجرعة"><Input value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} /></Field>
            <Field label="التكرار"><Input value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowMedForm(false)}>إلغاء</Button>
            <Button onClick={addMed}>حفظ الدواء</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLabForm} onClose={() => setShowLabForm(false)} title="إضافة تحليل مخبري">
        <div className="space-y-4">
          <Field label="التحليل" required>
            <Select value={newLab.marker} onChange={(e) => setNewLab({ ...newLab, marker: e.target.value })}>
              {LAB_MARKERS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="القيمة" required><Input type="number" value={newLab.value} onChange={(e) => setNewLab({ ...newLab, value: e.target.value })} /></Field>
            <Field label="الوحدة"><Input value={newLab.unit} onChange={(e) => setNewLab({ ...newLab, unit: e.target.value })} placeholder="ng/mL" /></Field>
            <Field label="المدى المرجعي"><Input value={newLab.referenceRange} onChange={(e) => setNewLab({ ...newLab, referenceRange: e.target.value })} placeholder="30-400" /></Field>
          </div>
          <Field label="تاريخ التحليل"><Input type="date" value={newLab.testDate} onChange={(e) => setNewLab({ ...newLab, testDate: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowLabForm(false)}>إلغاء</Button>
            <Button onClick={addLab}>حفظ التحليل</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showIntakeForm} onClose={() => setShowIntakeForm(false)} title="تسجيل تعاطٍ">
        <div className="space-y-4">
          <Field label="اسم المكمل" required><Input value={newLog.supplementName} onChange={(e) => setNewLog({ ...newLog, supplementName: e.target.value })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="الجرعة" required><Input type="number" value={newLog.doseAmount} onChange={(e) => setNewLog({ ...newLog, doseAmount: e.target.value })} /></Field>
            <Field label="الوحدة">
              <Select value={newLog.doseUnit} onChange={(e) => setNewLog({ ...newLog, doseUnit: e.target.value })}>
                <option value="g">جم</option>
                <option value="mg">ملجم</option>
                <option value="scoop">سكوب</option>
                <option value="capsule">كبسولة</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle checked={newLog.withFood} onChange={(v) => setNewLog({ ...newLog, withFood: v })} label="مع الطعام" />
            <Toggle checked={newLog.compliant} onChange={(v) => setNewLog({ ...newLog, compliant: v })} label="التزام بالجرعة" />
          </div>
          <Field label="أعراض جانبية"><Input value={newLog.sideEffects} onChange={(e) => setNewLog({ ...newLog, sideEffects: e.target.value })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="مستوى الطاقة (1-10)"><Input type="number" min={1} max={10} value={newLog.energyLevel} onChange={(e) => setNewLog({ ...newLog, energyLevel: e.target.value })} /></Field>
            <Field label="مستوى الاستشفاء (1-10)"><Input type="number" min={1} max={10} value={newLog.recoveryLevel} onChange={(e) => setNewLog({ ...newLog, recoveryLevel: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowIntakeForm(false)}>إلغاء</Button>
            <Button onClick={addLog}>تسجيل</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)} title="مراجعة التقييم">
        {approveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">التقييم بتاريخ {new Date(approveTarget.createdAt).toLocaleDateString('ar-EG')}</p>
            <Field label="الإجراء">
              <Select value={approveAction} onChange={(e) => setApproveAction(e.target.value)}>
                <option value="approved">اعتماد</option>
                <option value="rejected">رفض</option>
                <option value="adjusted">تعديل/إعادة</option>
              </Select>
            </Field>
            <Field label="ملاحظات"><Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApproveTarget(null)}>إلغاء</Button>
              <Button onClick={() => approve(approveTarget.id)}>تأكيد</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// parseIngredientJson: تحويل نص مكونات المنتج (JSON) إلى مصفوفة
// — وإن كان النص تالفًا نرجع قائمة فارغة بدل كسر الصفحة.
function parseIngredientJson(raw: string | null | undefined): { name: string; amount: number; unit: string }[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ========================================
// ResultsView: عرض نتائج التقييم (أقسام منفصلة)
// ========================================

function ResultsView({ result }: { result: SupplementAssessmentOutput }) {
  return (
    <div className="space-y-6">
      {/* الملخص العام + التحذيرات الشرطية */}
      <Alert
        variant={result.overallLevel === 'none' ? 'success' : result.overallLevel === 'specialist' ? 'warning' : 'info'}
        title={`ملخص النتيجة — المستوى العام: ${result.overallLevel}`}
      >
        {result.summary}
        {result.needsMedicalApproval && (
          <p className="mt-2">تحذير: التقييم يتطلب إشراف/موافقة مختص قبل أي استخدام.</p>
        )}
        {result.needsGuardianConsent && (
          <p className="mt-1">تحذير: يتطلب موافقة ولي الأمر للقاصر.</p>
        )}
        {result.needsLabTest && (
          <p className="mt-1">تحذير: بعض المكملات تحتاج تحليلًا مخبريًا مسبقًا.</p>
        )}
      </Alert>

      {/* التغطية */}
      <Card>
        <CardHeader icon={<ClipboardList className="h-5 w-5" />} title="تغطية الاحتياجات من الطعام" subtitle="أقل من 70% منخفضة · 70-90% تحتاج تحسينًا · 90-110% جيدة · أكثر من 110% مراجعة" />
        <div className="space-y-4">
          {result.coverage.map((row) => (
            <div key={row.key}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-slate-800">{row.nameAr}</span>
                <span className="text-xs text-slate-500">
                  الاحتياج {Math.round(row.requirement)} {row.unit} · من الطعام {Math.round(row.fromFood)} · المجموع {Math.round(row.total)}
                  {row.deficit > 0 && <span className="text-red-600"> · عجز {Math.round(row.deficit)}</span>}
                </span>
              </div>
              <ProgressBar value={row.coverageTotalPct} color={coverageBarClass(row.coverageTotalPct)} />
              {row.limitStatus === 'approaching' && (
                <p className="mt-1 text-xs text-amber-600"><AlertTriangle className="inline h-3.5 w-3.5" /> يقترب من الحد الأعلى الآمن ({row.upperLimit} {row.unit}).</p>
              )}
              {row.limitStatus === 'exceeded' && (
                <p className="mt-1 text-xs text-red-600"><XCircle className="inline h-3.5 w-3.5" /> تجاوز الحد الأعلى الآمن ({row.upperLimit} {row.unit}) — لا تتجاوزه أبدًا.</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* البروتين */}
      {result.proteinGap && (
        <Card>
          <CardHeader icon={<Beef className="h-5 w-5" />} title="فجوة البروتين" subtitle="الغذاء أولًا — تُقدر الحصة فقط بعد عرض الخيارات الغذائية" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="الاحتياج" value={`${result.proteinGap.requirementG} جم`} />
              <Stat label="من الطعام" value={`${result.proteinGap.fromFoodG} جم`} />
              <Stat label="العجز" value={`${result.proteinGap.deficitG} جم`} />
              <Stat label="حصص المسحوق التقديرية" value={result.proteinGap.powderScoops} sub="25 جم/حصة" />
            </div>
            {result.proteinGap.foodOptions.length > 0 && (
              <div>
                <p className="label">يمكنك تغطية العجز غذائيًا أولًا:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.proteinGap.foodOptions.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-700">{f.nameAr}</span>
                      <span className="text-xs text-slate-500">~{f.grams} جم · {f.proteinG} جم بروتين · {f.calories} سعرة</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">{result.proteinGap.note}</p>
          </div>
        </Card>
      )}

      {/* الترطيب */}
      {result.hydration && (
        <Card>
          <CardHeader icon={<Droplets className="h-5 w-5" />} title="الترطيب والكهرل" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="معدل التعرق" value={`${result.hydration.sweatRateLh} ل/س`} />
            <Stat label="سوائل أثناء" value={`${result.hydration.fluidsDuringMl} مل`} />
            <Stat label="سوائل بعد" value={`${result.hydration.fluidsAfterMl} مل`} />
            <Stat label="كهرل موصى" value={result.hydration.electrolytesRecommended ? 'نعم' : 'لا'} />
          </div>
          {result.hydration.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.hydration.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-700"><AlertTriangle className="inline h-4 w-4" /> {w}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* التوصيات */}
      <Card>
        <CardHeader icon={<CheckCircle2 className="h-5 w-5" />} title="توصيات المكملات المفحوصة" subtitle="كل نتيجة استرشادية تحتاج اعتماد مختص" />
        {result.recommendations.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title="لا توجد عناصر قابلة للدراسة" description="الغذاء الطبيعي يغطي احتياجاتك حاليًا." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.recommendations.map((rec) => (
              <div key={rec.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-800">{rec.nameAr}</p>
                  <Badge color={statusColor(rec.status)}>{rec.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">قوة الأدلة: {rec.evidenceStrength} · تغطية من الطعام: {Math.round(rec.coverageFromFoodPct)}% {rec.deficit > 0 ? `· عجز ${Math.round(rec.deficit)}` : ''}</p>
                {rec.doseEstimate != null && (
                  <p className="mt-2 text-sm font-semibold text-ocean-800">الجرعة التقديرية: {rec.doseEstimate} {rec.doseUnit} — {rec.timingAr}</p>
                )}
                {rec.upperLimitWarning && <p className="mt-1 text-xs text-amber-600"><AlertTriangle className="inline h-3.5 w-3.5" /> {rec.upperLimitWarning}</p>}
                <p className="mt-2 text-xs text-slate-500">{rec.medicalNote}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* الأهلية */}
      <Card>
        <CardHeader icon={<ShieldCheck className="h-5 w-5" />} title="فحص الأهلية والسلامة" />
        <div className="grid gap-2 md:grid-cols-2">
          {result.eligibility.map((e) => (
            <div key={e.key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-sm font-bold text-slate-700">{e.nameAr}</p>
                <p className="text-xs text-slate-500">{e.reasons.join(' · ')}</p>
              </div>
              <Badge color={e.ok ? 'green' : 'red'}>{e.verdict}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* الجدول */}
      {result.schedule.length > 0 && (
        <Card>
          <CardHeader icon={<Calendar className="h-5 w-5" />} title="الجدول المقترح" subtitle="وقت أخذ كل مكمل — يعدله المختص عند الاعتماد" />
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-3 py-2">الوقت</th>
                  <th className="px-3 py-2">العنصر</th>
                  <th className="px-3 py-2">الجرعة</th>
                  <th className="px-3 py-2">مع الطعام</th>
                  <th className="px-3 py-2">السبب</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold">{s.time}</td>
                    <td className="px-3 py-2">{s.item}</td>
                    <td className="px-3 py-2">{s.dose}</td>
                    <td className="px-3 py-2">{s.withFood ? 'نعم' : 'لا'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.schedule.some((s) => s.onCompetitionDay) && (
            <p className="mt-2 text-xs text-amber-600"><AlertTriangle className="inline h-3.5 w-3.5" /> عناصر موصوفة ليوم البطولة — لا تُجرَّب لأول مرة يوم السباق.</p>
          )}
        </Card>
      )}

      {/* بدائل غذائية */}
      {result.foodAlternatives.length > 0 && (
        <Card>
          <CardHeader icon={<Beef className="h-5 w-5" />} title="بدائل غذائية للعناصر الناقصة" subtitle="افعلها أولًا قبل التفكير في مكمل" />
          <div className="space-y-3">
            {result.foodAlternatives.map((alt) => (
              <div key={alt.key}>
                <p className="label">{alt.nameAr}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {alt.options.map((o, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-700">{o.nameAr}</span>
                      <span className="text-xs text-slate-500">~{o.grams} جم · {o.proteinG} جم بروتين · {o.calories} سعرة</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* تنبيه وإخلاء مسؤولية */}
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        <p className="text-sm font-black text-amber-900">تنبيه وإخلاء مسؤولية</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">{SUPPLEMENT_DISCLAIMER}</p>
        <div className="mt-4 border-t border-amber-200 pt-3 text-center">
          <p className="text-sm font-bold text-ocean-900">{SUPPLEMENT_BRANDING}</p>
          <p className="mt-1 text-xs text-slate-500">TOP ACADEMY — Smart Swimmer Nutrition</p>
        </div>
      </div>
    </div>
  );
}
