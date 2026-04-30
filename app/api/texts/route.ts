import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const texts = await prisma.pageText.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json(texts, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json([]);
  }
}
