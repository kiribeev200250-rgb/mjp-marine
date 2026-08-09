import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/crm/audit'
import { notifyAdmins } from '@/lib/crm/telegram/notify'

export const runtime = 'nodejs'

// GET — верификация webhook при подписке в Facebook App Dashboard
// (hub.mode=subscribe&hub.verify_token=...&hub.challenge=...)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const company = await prisma.companyInfo.findFirst({ where: { fbVerifyToken: token, fbEnabled: true } })
  if (!company) return NextResponse.json({ error: 'Verification failed' }, { status: 403 })

  return new NextResponse(challenge ?? '', { status: 200 })
}

interface LeadgenChange {
  field: string
  value: { leadgen_id: string; page_id?: string; form_id?: string; created_time?: number }
}
interface FbEntry { id: string; changes?: LeadgenChange[] }
interface FbWebhookBody { object?: string; entry?: FbEntry[] }

interface FbFieldDatum { name: string; values: string[] }
interface FbLeadDetails { field_data?: FbFieldDatum[] }

function pickField(fields: FbFieldDatum[], names: string[]): string {
  for (const n of names) {
    const f = fields.find((x) => x.name.toLowerCase() === n)
    if (f?.values?.[0]) return f.values[0]
  }
  return ''
}

// POST — уведомление о новом лиде. Payload не содержит данных лида — только
// leadgen_id, нужно отдельно запросить Graph API реквизитом Page Access Token.
export async function POST(req: NextRequest) {
  // Заготовка на будущее: пока нет реального FB App, но флаг fbEnabled=false
  // по умолчанию у всех компаний — если ни у кого не включено, тихо отвечаем 200.
  const company = await prisma.companyInfo.findFirst({ where: { fbEnabled: true } })
  if (!company) return NextResponse.json({ ok: true })

  const body = (await req.json().catch(() => null)) as FbWebhookBody | null
  if (!body?.entry) return NextResponse.json({ ok: true })

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue
      const leadgenId = change.value.leadgen_id
      if (!leadgenId) continue

      try {
        await processLead(company.companyId, leadgenId, company.fbPageToken)
      } catch (e) {
        console.error('[fb-lead-ads] Ошибка обработки лида', leadgenId, e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

async function processLead(companyId: string, leadgenId: string, pageToken: string | null): Promise<void> {
  // Идемпотентность — FB иногда повторяет доставку webhook
  const existing = await prisma.client.findFirst({ where: { companyId, fbLeadId: leadgenId } })
  if (existing) return

  if (!pageToken) {
    console.error('[fb-lead-ads] Нет Page Access Token — не могу запросить данные лида', leadgenId)
    return
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(pageToken)}`)
  if (!res.ok) {
    console.error('[fb-lead-ads] Graph API ошибка', leadgenId, res.status, await res.text().catch(() => ''))
    return
  }
  const details = (await res.json()) as FbLeadDetails
  const fields  = details.field_data ?? []

  const fullName = pickField(fields, ['full_name', 'name'])
  const firstFromParts = pickField(fields, ['first_name'])
  const lastFromParts  = pickField(fields, ['last_name'])
  const [firstName, ...rest] = fullName ? fullName.split(' ') : [firstFromParts || 'Facebook лид']
  const lastName = lastFromParts || rest.join(' ')

  const phone = pickField(fields, ['phone_number', 'phone'])
  const email = pickField(fields, ['email'])

  const client = await prisma.client.create({
    data: {
      companyId,
      firstName: firstName || 'Facebook лид',
      lastName,
      phone,
      email,
      source:   'FACEBOOK',
      fbLeadId: leadgenId,
    },
  })
  await prisma.funnelHistory.create({
    data: { clientId: client.id, toStage: 'NEW_LEAD', note: 'Лид с Facebook' },
  })
  await writeAudit({
    companyId, action: 'CREATE', entity: 'Client', entityId: client.id,
    newValue: { firstName: client.firstName, lastName: client.lastName },
    meta: { via: 'facebook_lead_ads' },
  })

  await notifyAdmins(companyId, `🆕 Новый лид с Facebook: ${client.firstName} ${client.lastName}${phone ? ` · ${phone}` : ''}`)
}
