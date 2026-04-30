import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  return !!(await getServerSession(authOptions));
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.pageText.findMany({ orderBy: { key: 'asc' } }));
}

export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items: Array<{ key: string; en: string; es: string; ru: string; uk: string }> = await req.json();
  const updated = await Promise.all(
    items.map((item) =>
      prisma.pageText.upsert({
        where: { key: item.key },
        update: { en: item.en, es: item.es, ru: item.ru, uk: item.uk },
        create: item,
      })
    )
  );
  return NextResponse.json(updated);
}
