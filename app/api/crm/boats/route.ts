import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { hasPermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST /api/crm/boats — добавить лодку клиенту
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'CLIENTS', 'CREATE')) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const body = await req.json()
  const { clientId, name, model, length, engine, marina, regNumber, notes } = body as {
    clientId?: string
    name?: string
    model?: string
    length?: string | number
    engine?: string
    marina?: string
    regNumber?: string
    notes?: string
  }

  if (!clientId) return NextResponse.json({ error: 'Не указан клиент' }, { status: 400 })
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId: session.user.companyId } })
  if (!client) return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })

  const boat = await prisma.yacht.create({
    data: {
      clientId,
      name:      (name ?? '').trim(),
      model:     (model ?? '').trim(),
      length:    length != null && length !== '' ? length.toString() : null,
      engine:    (engine ?? '').trim(),
      marina:    (marina ?? client.marina ?? '').trim(),
      regNumber: (regNumber ?? '').trim(),
      notes:     (notes ?? '').trim(),
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'CREATE',
    entity:    'Yacht',
    entityId:  boat.id,
    newValue:  { clientId, name: boat.name || boat.model },
  })

  return NextResponse.json(boat, { status: 201 })
}
