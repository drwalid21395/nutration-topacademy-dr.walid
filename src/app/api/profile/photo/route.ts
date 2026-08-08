import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/security';
import { syncToGoogleDrive, driveFileUrl } from '@/lib/google-sync';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * رفع صورة السباح الشخصية.
 * يحفظ محليًا عند توفره (بيئة التطوير)، وينسخها إلى Google Drive
 * (فولدر السباح) لتبقى متاحة على الإنتاج، ثم يحدّث حقل الصورة في الحساب.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`avatar:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'طلبات كثيرة' }, { status: 429 });
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  if (!body.image || !body.image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'صورة غير صالحة' }, { status: 422 });
  }

  const raw = body.image.split(',')[1];
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'حجم الصورة يتجاوز 2 ميجابايت' }, { status: 422 });
  }

  const mime = body.image.includes('image/png')
    ? 'image/png'
    : body.image.includes('image/webp')
      ? 'image/webp'
      : 'image/jpeg';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${user.id}.${ext}`;

  let imageUrl = '';

  try {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
    const storageBase = process.env.STORAGE_BASE_URL ?? '';
    imageUrl = `${storageBase}/uploads/avatars/${filename}`;
  } catch {
    // على Vercel (نظام ملفات للقراءة فقط) نعتمد على درايف أو التخزين المضمّن
  }

  if (!imageUrl) {
    try {
      const drive = await syncToGoogleDrive({
        type: 'avatar',
        data: { swimmerName: user.name },
        photos: [{ fileName: filename, mimeType: mime, base64: raw, folder: 'avatars' }],
      });
      if (drive.photoIds?.[0]) {
        imageUrl = driveFileUrl(drive.photoIds[0]);
      }
    } catch {
      // درايف اختياري
    }
  }

  // الحل الأخير المضمون: تخزين الصورة مضمّنة (data URI) في حساب المستخدم
  // حتى تظهر الصورة دائمًا حتى لو فشل التخزين المحلي ودرايف.
  if (!imageUrl) {
    imageUrl = `data:${mime};base64,${raw}`;
  }

  await prisma.user.update({ where: { id: user.id }, data: { image: imageUrl } });

  return NextResponse.json({ ok: true, image: imageUrl });
}
