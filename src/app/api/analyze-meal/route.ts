import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisionProvider, ANALYZE_DISCLAIMER } from '@/services/ai';
import { rateLimit, audit } from '@/lib/security';
import { syncToGoogleDrive } from '@/lib/google-sync';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`analyze:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة، حاول لاحقًا' }, { status: 429 });
  }

  let body: { image?: string; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.image || !body.image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'صورة غير صالحة' }, { status: 422 });
  }

  const base64 = body.image.split(',')[1];
  const imageBytes = Buffer.from(base64, 'base64');
  if (imageBytes.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'حجم الصورة يتجاوز 5 ميجابايت — التقط صورة أخف' },
      { status: 422 }
    );
  }

  const consent = body.consent !== false;

  let photoId: string | null = null;
  let photoUrl: string | null = null;

  if (consent) {
    try {
      const id = crypto.randomUUID();
      const dir = path.join(process.cwd(), 'public', 'uploads', 'meals', user.id);
      await mkdir(dir, { recursive: true });
      const ext = body.image.includes('image/png') ? 'png' : 'jpg';
      const filename = `${id}.${ext}`;
      await writeFile(path.join(dir, filename), imageBytes);

      const storageBase = process.env.STORAGE_BASE_URL ?? '';
      photoUrl = `${storageBase}/uploads/meals/${user.id}/${filename}`;
      const autoDeleteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 أيام
      const photo = await prisma.photo.create({
        data: {
          userId: user.id,
          url: photoUrl,
          storageKey: `meals/${user.id}/${filename}`,
          analysisConsent: true,
          autoDeleteAt,
        },
      });
      photoId = photo.id;
    } catch (e) {
      // عدم توفير التخزين لا يمنع التحليل
    }
  }

  try {
    const provider = getVisionProvider();
    const result = await provider.analyze(body.image);

    const analysis = await prisma.mealAnalysis.create({
      data: {
        userId: user.id,
        photoId,
        provider: result.provider,
        rawResponse: result.raw ? JSON.stringify(result.raw) : null,
        foods: result.foods ? JSON.stringify(result.foods) : null,
        totalCalories: result.totalCalories,
        totalProteinG: result.totalProteinG,
        totalCarbsG: result.totalCarbsG,
        totalFatG: result.totalFatG,
        totalFiberG: result.totalFiberG,
        totalSodiumMg: result.totalSodiumMg,
        confidence: result.confidence,
        isEstimate: true,
        needsReview: result.needsReview ?? true,
        notes: result.notes,
      },
    });

    await audit(user.id, 'meal.analyze', 'MealAnalysis', analysis.id, {
      provider: result.provider,
      photoSaved: !!photoId,
    });

    if (consent) {
      const mime = body.image.includes('image/png') ? 'image/png' : 'image/jpeg';
      syncToGoogleDrive({
        type: 'meal-analysis',
        data: {
          name: user.name,
          email: user.email,
          swimmerName: user.name,
          analysisId: analysis.id,
          provider: result.provider,
          confidence: result.confidence,
          totalCalories: result.totalCalories,
          totalProteinG: result.totalProteinG,
          totalCarbsG: result.totalCarbsG,
          totalFatG: result.totalFatG,
          totalFiberG: result.totalFiberG,
          totalSodiumMg: result.totalSodiumMg,
          foods: result.foods ? JSON.stringify(result.foods) : null,
          notes: result.notes,
        },
        photos: [
          {
            fileName: `${user.id}-${analysis.id}.${mime === 'image/png' ? 'png' : 'jpg'}`,
            mimeType: mime,
            base64,
            folder: 'meals',
          },
        ],
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      analysisId: analysis.id,
      result,
      disclaimer: ANALYZE_DISCLAIMER,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر تحليل الصورة';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
