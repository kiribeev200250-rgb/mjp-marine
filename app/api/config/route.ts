import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
