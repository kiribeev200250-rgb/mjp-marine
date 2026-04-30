import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendContactEmail } from '@/lib/resend';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, marina, boatType, service, message } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    await prisma.contactRequest.create({
      data: { name, phone, email: email || null, marina: marina || null, boatType: boatType || null, service: service || null, message: message || null },
    });

    await sendContactEmail({ name, phone, email, marina, boatType, service, message }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
