import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contacts = await prisma.contactRequest.findMany({ orderBy: { createdAt: 'desc' } });

  const csv = [
    'id,name,phone,email,marina,boat_type,service,message,read,created_at',
    ...contacts.map((c) =>
      [
        c.id,
        `"${c.name}"`,
        `"${c.phone}"`,
        `"${c.email ?? ''}"`,
        `"${c.marina ?? ''}"`,
        `"${c.boatType ?? ''}"`,
        `"${c.service ?? ''}"`,
        `"${(c.message ?? '').replace(/"/g, '""')}"`,
        c.read,
        c.createdAt.toISOString(),
      ].join(',')
    ),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
    },
  });
}
