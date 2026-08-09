import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { writeAudit } from '@/lib/crm/audit'
import { prisma } from '@/lib/prisma'

// POST — включить/выключить FB Lead Ads и сохранить токены
export async function POST(req: NextRequest) {
  const session = await getCrmSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  requirePermission(session.user.role, session.user.permissions, 'SETTINGS', 'EDIT')

  const { fbEnabled, fbAppId, fbPageToken, fbVerifyToken } = await req.json()

  const prev = await prisma.companyInfo.findUnique({ where: { companyId: session.user.companyId } })
  if (!prev) return NextResponse.json({ error: 'Сначала заполните реквизиты компании' }, { status: 400 })

  const updated = await prisma.companyInfo.update({
    where: { companyId: session.user.companyId },
    data: {
      fbEnabled:     !!fbEnabled,
      fbAppId:       fbAppId       ?? '',
      fbPageToken:   fbPageToken   ?? '',
      fbVerifyToken: fbVerifyToken ?? '',
    },
  })

  await writeAudit({
    companyId: session.user.companyId,
    userId:    session.user.id,
    action:    'UPDATE',
    entity:    'CompanyInfo',
    entityId:  updated.id,
    meta:      { action: 'fb_lead_ads_settings', fbEnabled: updated.fbEnabled },
  })

  return NextResponse.json({ ok: true })
}
