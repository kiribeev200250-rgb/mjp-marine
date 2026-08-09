import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'
import type { ClientSource } from '@prisma/client'

// POST /api/crm/clients/import — CSV-импорт клиентов
// Ожидает JSON: { rows: [{ firstName, lastName, phone, email, marina, source, language, notes }] }
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'CREATE')

  const { rows } = await req.json() as { rows: Record<string, string>[] }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Нет данных для импорта' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Максимум 500 строк за раз' }, { status: 400 })
  }

  const validSources: ClientSource[] = ['FACEBOOK','MANUAL','REFERRAL','WEBSITE','WHATSAPP','OTHER']
  const companyId = session.user.companyId
  const created: string[] = []
  const errors:  { row: number; error: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const firstName = row.firstName?.trim() || row['Имя']?.trim()
    if (!firstName) {
      errors.push({ row: i + 1, error: 'Не указано имя' })
      continue
    }

    try {
      const source = (validSources.includes(row.source as ClientSource)
        ? row.source
        : 'MANUAL') as ClientSource

      const client = await prisma.client.create({
        data: {
          companyId,
          firstName,
          lastName:    (row.lastName  || row['Фамилия'] || '').trim(),
          phone:       (row.phone     || row['Телефон']  || '').trim(),
          email:       (row.email     || row['Email']    || '').trim().toLowerCase(),
          marina:      (row.marina    || row['Марина']   || '').trim(),
          language:    (row.language  || row['Язык']     || 'ru').trim(),
          notes:       (row.notes     || row['Заметки']  || '').trim(),
          source,
          funnelStage: 'NEW_LEAD',
        },
      })

      await prisma.funnelHistory.create({
        data: { clientId: client.id, toStage: 'NEW_LEAD' },
      })

      created.push(client.id)
    } catch {
      errors.push({ row: i + 1, error: 'Ошибка записи' })
    }
  }

  await writeAudit({
    companyId,
    userId:   session.user.id,
    action:   'CREATE',
    entity:   'Client',
    entityId: 'csv-import',
    meta:     { imported: created.length, errors: errors.length },
  })

  return NextResponse.json({ imported: created.length, errors })
}
