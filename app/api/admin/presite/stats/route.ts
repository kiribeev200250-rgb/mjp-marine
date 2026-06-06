import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function GET(request: Request) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';

  let dateFilter: object = {};
  if (period === '7d') {
    dateFilter = { clickedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
  } else if (period === '30d') {
    dateFilter = { clickedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
  }

  const links = await prisma.presiteLink.findMany({ orderBy: { sortOrder: 'asc' } });

  const result = await Promise.all(
    links.map(async (link) => {
      const count = await prisma.presiteStat.count({
        where: { linkId: link.id, ...dateFilter },
      });
      return { id: link.id, label: link.label, platform: link.platform, count };
    })
  );

  const total = result.reduce((s, r) => s + r.count, 0);
  return NextResponse.json({ links: result, total });
}
