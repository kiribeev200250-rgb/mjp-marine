import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.presiteConfig.findUnique({ where: { id: 1 } }));
}

export async function PUT(req: NextRequest) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: _id, ...data } = await req.json();
  return NextResponse.json(
    await prisma.presiteConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  );
}
