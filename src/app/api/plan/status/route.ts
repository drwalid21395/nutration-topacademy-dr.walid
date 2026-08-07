import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const [profileCount, targetsCount] = await Promise.all([
    prisma.swimmerProfile.count({ where: { userId: user.id } }),
    prisma.nutritionTargets.count({ where: { profile: { userId: user.id } } }),
  ]);

  return NextResponse.json({
    hasProfile: profileCount > 0,
    hasTargets: targetsCount > 0,
  });
}
