'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Trash2,
  Sparkles,
  Check,
  AlertTriangle,
  ShieldCheck,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Alert, Badge, Spinner } from '@/components/ui';
import { Input } from '@/components/ui/forms';
import { ANALYZE_DISCLAIMER } from '@/services/ai';
import type { MealAnalysisResult } from '@/types';
import { formatNumber } from '@/lib/utils';

export function MealAnalyzer({
  targets,
}: {
  targets: { calories?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MealAnalysisResult | null>(null);
  const [edited, setEdited] = useState<MealAnalysisResult | null>(null);
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function getMediaWithTimeout(constraints: MediaStreamConstraints, ms: number) {
    return new Promise<MediaStream>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new DOMException('استغرقت عملية فتح الكاميرا وقتًا طويلًا', 'TimeoutError')),
        ms
      );
      navigator.mediaDevices.getUserMedia(constraints).then(
        (s) => {
          clearTimeout(t);
          resolve(s);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  async function startCamera() {
    setCameraError(null);
    setCameraReady(false);
    setCameraRequesting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('المتصفح لا يدعم الكاميرا على هذا الرابط. استخدم HTTPS أو localhost.');
        return;
      }
      let stream: MediaStream | null = null;
      try {
        // جرّب الكاميرا الخلفية أولًا (مثالية لتصوير الوجبة من الجوال)
        stream = await getMediaWithTimeout(
          {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          15000
        );
      } catch {
        // الكاميرا الخلفية غير متاحة (كمبيوتر/بعض الأجهزة) — استخدم أي كاميرا افتراضية
        stream = await getMediaWithTimeout({ video: true, audio: false }, 15000);
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      await video.play();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('رُفض إذن الكاميرا. اضغط أيقونة القفل في شريط العنوان ثم اسمح بالكاميرا وحاول مجددًا.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('لم يُعثر على كاميرا متاحة. استخدم زر «التقاط بالكاميرا» أو رفع صورة من الجهاز.');
      } else if (name === 'OverconstrainedError') {
        setCameraError('الكاميرا المتاحة لا تلبي إعدادات التصوير. استخدم زر «التقاط بالكاميرا» أو رفع صورة.');
      } else if (name === 'TimeoutError') {
        setCameraError('استغرق فتح الكاميرا وقتًا طويلًا. استخدم زر «التقاط بالكاميرا» — الأكثر توافقًا مع الجوال.');
      } else {
        setCameraError('تعذر تشغيل كاميرا المعاينة. استخدم زر «التقاط بالكاميرا» أو رفع صورة من الجهاز.');
      }
      stopCamera();
    } finally {
      setCameraRequesting(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setCameraReady(false);
  }

  // ضغط الصورة في المتصفح حتى لا يتجاوز حجم الطلب حد الخادم (يحدث خطأ JSON عند تجاوزه)
  function compressImage(dataUrl: string, maxDim = 1280, quality = 0.78): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCameraError('الكاميرا لم تعرض إطارًا بعد. انتظر لحظة ثم أعد المحاولة.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(await compressImage(canvas.toDataURL('image/jpeg', 0.85)));
    stopCamera();
    setResult(null);
    setEdited(null);
    setAdded(false);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setPhoto(await compressImage(String(reader.result)));
      setResult(null);
      setEdited(null);
      setAdded(false);
    };
    reader.readAsDataURL(file);
  }

  function resetAll() {
    setPhoto(null);
    setResult(null);
    setEdited(null);
    setError(null);
    setAdded(false);
  }

  async function analyze() {
    if (!photo) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, consent }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('الخادم رفض الصورة (الحجم أكبر من المسموح). أعد التقاط صورة أقرب وأخفض جودة ثم حاول مجددًا.');
      }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'تعذر التحليل');
      setResult(data.result as MealAnalysisResult);
      setEdited(data.result as MealAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحليل');
    } finally {
      setAnalyzing(false);
    }
  }

  function updateFood(i: number, field: string, value: string | number) {
    if (!edited) return;
    const foods = [...edited.foods];
    foods[i] = { ...foods[i], [field]: value };
    const totals = recompute(foods);
    setEdited({ ...edited, foods, ...totals });
  }

  function recompute(foods: MealAnalysisResult['foods']) {
    return {
      totalCalories: Math.round(foods.reduce((a, f) => a + (f.calories ?? 0), 0)),
      totalProteinG: Math.round(foods.reduce((a, f) => a + (f.proteinG ?? 0), 0) * 10) / 10,
      totalCarbsG: Math.round(foods.reduce((a, f) => a + (f.carbsG ?? 0), 0) * 10) / 10,
      totalFatG: Math.round(foods.reduce((a, f) => a + (f.fatG ?? 0), 0) * 10) / 10,
    };
  }

  async function addToLog() {
    if (!edited) return;
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'food',
        foodName: edited.foods.map((f) => f.nameAr).join(' + '),
        calories: edited.totalCalories,
        proteinG: edited.totalProteinG,
        carbsG: edited.totalCarbsG,
        fatG: edited.totalFatG,
        fiberG: edited.totalFiberG,
        sodiumMg: edited.totalSodiumMg,
        source: 'analysis',
      }),
    });
    if (res.ok) {
      setAdded(true);
    } else {
      const data = await res.json();
      setError(data.error ?? 'تعذر الإضافة للسجل');
    }
  }

  const remaining = (targets?.calories ?? 2200) - (edited?.totalCalories ?? 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-ocean-900">محلل الوجبات الذكي</h1>
        <p className="mt-1 text-sm text-slate-500">
          صوّر وجبتك ليقدر النظام السعرات والمغذيات تلقائيًا، ثم عدّل النتائج وأضفها لسجل اليوم.
        </p>
      </div>

      <div className="mb-4">
        <Alert variant="info" title="تنبيه دقة التحليل">{ANALYZE_DISCLAIMER}</Alert>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* الالتقاط */}
        <Card>
          <h2 className="mb-3 text-base font-bold text-ocean-900">التقاط الوجبة</h2>

          {!photo && !cameraOn && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-14 text-center">
              <Camera className="h-12 w-12 text-ocean-300" />
              <p className="max-w-xs text-sm text-slate-500">التقط صورة لوجبتك بالكاميرا أو ارفع صورة من جهازك</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={startCamera} loading={cameraRequesting}>
                  <Camera className="h-4 w-4" />
                  {cameraRequesting ? 'جارٍ فتح الكاميرا…' : 'تشغيل الكاميرا'}
                </Button>
                <Button onClick={() => captureInputRef.current?.click()} variant="gold">
                  <Camera className="h-4 w-4" />
                  التقاط بالكاميرا
                </Button>
                <label className="btn-secondary cursor-pointer">
                  <Upload className="h-4 w-4" />
                  رفع صورة
                  <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                </label>
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onUpload}
                />
              </div>
              {cameraError && <p className="max-w-xs text-xs text-red-600">{cameraError}</p>}
            </div>
          )}

          {cameraOn && (
            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="mx-auto max-h-80 w-full object-contain"
                onCanPlay={() => setCameraReady(true)}
                onLoadedData={() => setCameraReady(true)}
              />
              <div className="flex justify-center gap-3 p-4">
                <Button onClick={capture} variant="gold" disabled={!cameraReady}>
                  <Camera className="h-4 w-4" />
                  {cameraReady ? 'التقاط' : 'جارٍ تشغيل الكاميرا…'}
                </Button>
                <Button onClick={stopCamera} variant="secondary">إلغاء</Button>
              </div>
              {!cameraReady && (
                <p className="px-4 pb-3 text-center text-xs text-slate-400">
                  في حال بقيت الشاشة سوداء، امنح إذن الكاميرا من المتصفح ثم أعد المحاولة.
                </p>
              )}
            </div>
          )}

          {photo && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="الوجبة" className="max-h-80 w-full rounded-2xl object-cover" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={startCamera} variant="secondary">
                  <RefreshCw className="h-4 w-4" />
                  إعادة التصوير
                </Button>
                <Button onClick={resetAll} variant="secondary">
                  <Trash2 className="h-4 w-4" />
                  حذف الصورة
                </Button>
                <label className="btn-secondary cursor-pointer">
                  <Upload className="h-4 w-4" />
                  صورة أخرى
                  <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                </label>
              </div>
            </div>
          )}

          {photo && !result && (
            <div className="mt-4">
              <label className="mb-2 flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded text-ocean-600" />
                <span>أوافق على حفظ الصورة مؤقتًا (7 أيام) لأغراض التحليل فقط، ولن تُستخدم لتدريب أي نموذج.</span>
              </label>
              <Button onClick={analyze} loading={analyzing} className="w-full">
                <Sparkles className="h-4 w-4" />
                تحليل الوجبة
              </Button>
            </div>
          )}

          {error && <div className="mt-4"><Alert variant="danger">{error}</Alert></div>}
        </Card>

        {/* النتائج */}
        <div className="space-y-5">
          {analyzing && (
            <Card>
              <Spinner label="جارٍ تحليل الصورة بالذكاء الاصطناعي…" />
            </Card>
          )}

          {result && edited && !analyzing && (
            <>
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-ocean-900">نتيجة التحليل</h2>
                  <div className="flex items-center gap-2">
                    <Badge color={edited.confidence && edited.confidence > 65 ? 'green' : 'gold'}>
                      ثقة {Math.round(edited.confidence ?? 0)}٪
                    </Badge>
                    {edited.needsReview && <Badge color="gold"><AlertTriangle className="ml-1 h-3 w-3" /> يحتاج مراجعة</Badge>}
                  </div>
                </div>

                <div className="space-y-3">
                  {edited.foods.map((f, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={f.nameAr}
                          onChange={(e) => updateFood(i, 'nameAr', e.target.value)}
                          className="!py-1.5 font-bold"
                        />
                        <Badge color="ocean">{formatNumber(f.grams)} جم</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                        {[
                          ['calories', 'سعرات', f.calories],
                          ['proteinG', 'بروتين', f.proteinG],
                          ['carbsG', 'كربوهيدرات', f.carbsG],
                          ['fatG', 'دهون', f.fatG],
                        ].map(([field, label, value]) => (
                          <label key={field as string} className="rounded-lg bg-slate-50 p-2">
                            <span className="mb-1 block text-slate-500">{label}</span>
                            <Input
                              type="number"
                              dir="ltr"
                              className="!px-2 !py-1 text-center"
                              value={Number(value ?? 0)}
                              onChange={(e) => updateFood(i, field as string, Number(e.target.value))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-ocean-700 to-ocean-950 text-white">
                <h2 className="mb-3 text-base font-bold">مقارنة بالهدف اليومي</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-ocean-200">السعرات المتبقية</p>
                    <p className={remaining < 0 ? 'text-xl font-black text-red-300' : 'text-xl font-black text-white'}>
                      {remaining < 0 ? `تجاوز ${Math.abs(remaining)}` : formatNumber(remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ocean-200">السعرات المستهلكة</p>
                    <p className="text-xl font-black">{formatNumber(edited.totalCalories)} / {formatNumber(targets?.calories ?? 2200)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ['البروتين', edited.totalProteinG, targets?.proteinG],
                    ['الكربوهيدرات', edited.totalCarbsG, targets?.carbsG],
                    ['الدهون', edited.totalFatG, targets?.fatG],
                  ].map(([label, val, target]) => (
                    <div key={label as string} className="flex items-center justify-between text-xs">
                      <span className="text-ocean-200">{label}</span>
                      <span className="font-bold">{formatNumber(Number(val), 1)} / {formatNumber(Number(target ?? 0), 1)} جم</span>
                    </div>
                  ))}
                </div>
                {edited.totalProteinG < (targets?.proteinG ?? 0) * 0.5 && (
                  <div className="mt-3 rounded-lg bg-white/10 p-2.5 text-xs">
                    <ShieldCheck className="mb-1 h-4 w-4 text-gold-300" />
                    اقتراح: أضف مصدرًا بروتينيًا (زبادي، دجاج، عدس) لهذه الوجبة لتحسين التوازن.
                  </div>
                )}
              </Card>

              <div className="flex flex-wrap gap-2">
                {added ? (
                  <Button variant="secondary" disabled>
                    <Check className="h-4 w-4" />
                    أُضيفت للسجل ✓
                  </Button>
                ) : (
                  <Button onClick={addToLog} variant="gold" className="flex-1">
                    <Check className="h-4 w-4" />
                    تأكيد وإضافة للسجل اليومي
                  </Button>
                )}
                <Button onClick={resetAll} variant="secondary">
                  <Trash2 className="h-4 w-4" />
                  تحليل وجبة أخرى
                </Button>
              </div>
            </>
          )}

          {!result && !analyzing && (
            <Card className="flex flex-col items-center justify-center gap-2 py-14 text-center text-slate-400">
              <Pencil className="h-8 w-8" />
              <p className="max-w-xs text-sm">التقط صورة أولًا ليعرض النظام هنا تقديرات السعرات والمغذيات القابلة للتعديل.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
