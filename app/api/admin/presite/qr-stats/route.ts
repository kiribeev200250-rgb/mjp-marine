import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const [today, week, month, total, qrClicks] = await Promise.all([
    prisma.presiteScan.count({ where: { scannedAt: { gte: todayStart } } }),
    prisma.presiteScan.count({ where: { scannedAt: { gte: weekStart } } }),
    prisma.presiteScan.count({ where: { scannedAt: { gte: monthStart } } }),
    prisma.presiteScan.count(),
    prisma.presiteStat.count({ where: { source: 'qr' } }),
  ]);

  const conversionRate = total > 0 ? Math.round((qrClicks / total) * 100) : 0;

  return NextResponse.json({ today, week, month, total, conversionRate });
}