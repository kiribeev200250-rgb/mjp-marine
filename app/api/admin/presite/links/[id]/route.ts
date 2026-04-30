import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { id: _id, stats: _s, ...data } = body;
  return NextResponse.json(await prisma.presiteLink.update({ where: { id: Number(id) }, data }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.presiteLink.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
