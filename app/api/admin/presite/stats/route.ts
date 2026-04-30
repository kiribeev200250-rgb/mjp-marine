import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = await prisma.presiteLink.findMany({ orderBy: { sortOrder: 'asc' } });
  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const result = await Promise.all(
    links.map(async (link) => {
      const [total, last7, last30] = await Promise.all([
        prisma.presiteStat.count({ where: { linkId: link.id } }),
        prisma.presiteStat.count({ where: { linkId: link.id, clickedAt: { gte: day7 } } }),
        prisma.presiteStat.count({ where: { linkId: link.id, clickedAt: { gte: day30 } } }),
      ]);
      return { id: link.id, label: link.label, platform: link.platform, total, last7, last30 };
    })
  );

  const totalClicks = result.reduce((s, r) => s + r.total, 0);
  return NextResponse.json({ links: result, total: totalClicks });
}
