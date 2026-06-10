import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { linkId, source } = body;

    if (!linkId && source === 'qr') {
      await prisma.presiteScan.create({ data: { source: 'qr' } });
      return NextResponse.json({ ok: true, type: 'qr_scan' });
    }

    if (!linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });

    await prisma.presiteStat.create({
      data: { linkId: Number(linkId), source: source || 'direct' },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}