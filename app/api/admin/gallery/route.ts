import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  return !!(await getServerSession(authOptions));
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.galleryItem.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.galleryItem.create({
    data: {
      title: body.title ?? '',
      titleEs: body.titleEs ?? '',
      titleRu: body.titleRu ?? '',
      titleUk: body.titleUk ?? '',
      description: body.description ?? '',
      descEs: body.descEs ?? '',
      descRu: body.descRu ?? '',
      descUk: body.descUk ?? '',
      beforeUrl: body.beforeUrl ?? '',
      afterUrl: body.afterUrl ?? '',
      serviceTag: body.serviceTag ?? '',
      sortOrder: body.sortOrder ?? 0,
      visible: body.visible !== false,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
