import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfToday } from '@/lib/utils';
import { buildAdminReportPdf, buildCsv, type AdminReportRow } from '@/services/pdf/admin-report-pdf';
import { saveReportToDrive } from '@/lib/google-sync';

/**
 * طھظ‚ط§ط±ظٹط± ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ ظ„ظ„ط£ط¯ظ…ظ†.
 * GET ?format=pdf|csv&userId=<id>&days=7
 * PDF ظˆ Excel (CSV ظ…طھظˆط§ظپظ‚ ظ…ط¹ Excel ط§ظ„ط¹ط±ط¨ظٹ) â€” ظ…ط¹ ط­ظپط¸ ظ†ط³ط®ط© ظپظٹ Google Drive.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'ظ„ظٹط³طھ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط©' }, { status: 403 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'pdf') === 'csv' ? 'csv' : 'pdf';
  const userId = url.searchParams.get('userId') ?? undefined;
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);

  const todayStart = startOfToday();
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const swimmerIds = await prisma.user.findMany({
    where: { role: 'athlete', status: { not: 'deleted' }, ...(userId ? { id: userId } : {}) },
    select: { id: true },
  });
  const ids = swimmerIds.map((s) => s.id);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ظ„ط§ ظٹظˆط¬ط¯ ط³ط¨ط§ط­ظˆظ†' }, { status: 404 });
  }

  const [users, foodLogDays] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        profiles: { orderBy: { updatedAt: 'desc' }, take: 1, select: { fullName: true } },
        mealPlans: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, title: true, totalCalories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
        },
        foodLogs: {
          where: { date: { gte: todayStart } },
          select: { calories: true, proteinG: true, carbsG: true, fatG: true, waterMl: true },
        },
        waterLogs: { where: { date: { gte: todayStart } }, select: { amountMl: true } },
      },
    }),
    prisma.foodLogEntry.groupBy({
      by: ['userId', 'date'],
      where: { date: { gte: weekAgo }, userId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const daysPerUser = new Map<string, Set<string>>();
  for (const row of foodLogDays) {
    const key = row.date.toISOString().slice(0, 10);
    if (!daysPerUser.has(row.userId)) daysPerUser.set(row.userId, new Set());
    daysPerUser.get(row.userId)!.add(key);
  }

  const rows: AdminReportRow[] = users.map((u) => {
    const plan = u.mealPlans[0] ?? null;
    const food = u.foodLogs.reduce<{ c: number; p: number; ca: number; f: number; w: number }>(
      (a, e) => ({
        c: a.c + (e.calories ?? 0),
        p: a.p + (e.proteinG ?? 0),
        ca: a.ca + (e.carbsG ?? 0),
        f: a.f + (e.fatG ?? 0),
        w: a.w + (e.waterMl ?? 0),
      }),
      { c: 0, p: 0, ca: 0, f: 0, w: 0 }
    );
    const waterMl = food.w + u.waterLogs.reduce((a, w) => a + w.amountMl, 0);
    const pct = (v: number, t: number | null | undefined) => (t && t > 0 ? Math.min(100, Math.round((v / t) * 100)) : null);

    return {
      name: u.profiles[0]?.fullName ?? u.name ?? u.email,
      email: u.email,
      planTitle: plan?.title ?? null,
      caloriesPct: pct(food.c, plan?.totalCalories),
      proteinPct: pct(food.p, plan?.proteinG),
      carbsPct: pct(food.ca, plan?.carbsG),
      fatPct: pct(food.f, plan?.fatG),
      waterPct: pct(waterMl, plan?.waterMl),
      activeDays7: daysPerUser.get(u.id)?.size ?? 0,
      todayCalories: Math.round(food.c),
      todayProtein: Math.round(food.p),
      todayWaterMl: Math.round(waterMl),
    };
  });

  const issueDate = new Date().toLocaleDateString('ar-EG');
  const swimmerLabel = userId ? rows[0]?.name ?? 'ط§ظ„ط³ط¨ط§ط­' : 'ط¬ظ…ظٹط¹ ط§ظ„ط³ط¨ط§ط­ظٹظ†';
  const title = `طھظ‚ط±ظٹط± ط§ظ„ط§ظ„طھط²ط§ظ… ط§ظ„ط؛ط°ط§ط¦ظٹ â€” ${swimmerLabel}`;
  const subtitle = `ط§ظ„ظپطھط±ط©: ط¢ط®ط± ${days} ظٹظˆظ… آ· طھط§ط±ظٹط® ط§ظ„ط¥طµط¯ط§ط±: ${issueDate}`;
  const fileName = `adherence-report-${userId ?? 'all'}-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    const csv = buildCsv(
      ['ط§ظ„ط³ط¨ط§ط­', 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'ط§ظ„ط®ط·ط©', 'ط³ط¹ط±ط§طھ ط§ظ„ظٹظˆظ…', 'ط¨ط±ظˆطھظٹظ† ط§ظ„ظٹظˆظ…', 'ظ…ط§ط، ط§ظ„ظٹظˆظ…', '% ط³ط¹ط±ط§طھ', '% ط¨ط±ظˆطھظٹظ†', '% ظƒط§ط±ط¨', '% ط¯ظ‡ظˆظ†', '% ظ…ط§ط،', 'ط£ظٹط§ظ… طھط³ط¬ظٹظ„ (7)'],
      rows.map((r) => [
        r.name,
        r.email,
        r.planTitle ?? 'ط¨ط¯ظˆظ† ط®ط·ط©',
        r.todayCalories,
        r.todayProtein,
        r.todayWaterMl,
        r.caloriesPct ?? '',
        r.proteinPct ?? '',
        r.carbsPct ?? '',
        r.fatPct ?? '',
        r.waterPct ?? '',
        r.activeDays7,
      ])
    );
    saveReportToDrive({
      swimmerName: swimmerLabel,
      kind: 'admin-report',
      fileName: `${fileName}.csv`,
      mimeType: 'text/csv',
      base64: Buffer.from(csv, 'utf8').toString('base64'),
    }).catch(() => {});
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.csv"`,
      },
    });
  }

  const pdf = await buildAdminReportPdf({ title, subtitle, rows });
  saveReportToDrive({
    swimmerName: swimmerLabel,
    kind: 'admin-report',
    fileName: `${fileName}.pdf`,
    mimeType: 'application/pdf',
    base64: pdf.toString('base64'),
  }).catch(() => {});
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
    },
  });
}

