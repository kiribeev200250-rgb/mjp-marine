import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function auth() { return !!(await getServerSession(authOptions)); }

export async function PATCH(req: NextRequest) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { order }: { order: number[] } = await req.json();
  await Promise.all(
    order.map((id, index) => prisma.presiteLink.update({ where: { id }, data: { sortOrder: index + 1 } }))
  );
  return NextResponse.json({ ok: true });
}
