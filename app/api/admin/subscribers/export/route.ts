import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subscribers = await prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' } });

  const csv = [
    'id,name,email,language,active,created_at',
    ...subscribers.map((s) =>
      [s.id, `"${s.name}"`, `"${s.email}"`, s.language, s.active, s.createdAt.toISOString()].join(',')
    ),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
    },
  });
}
