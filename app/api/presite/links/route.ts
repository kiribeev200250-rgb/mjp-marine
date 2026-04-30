import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const links = await prisma.presiteLink.findMany({
      where: { active: true, url: { not: '' } },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(links);
  } catch {
    return NextResponse.json([]);
  }
}
