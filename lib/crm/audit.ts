import { prisma } from '@/lib/prisma'

interface AuditParams {
  companyId: string
  userId?: string | null
  action: string
  entity: string
  entityId: string
  oldValue?: unknown
  newValue?: unknown
  meta?: unknown
}

// Запись в аудит-лог. Вызывать при любой мутации денег/склада/статусов.
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId:    params.userId ?? undefined,
        action:    params.action,
        entity:    params.entity,
        entityId:  params.entityId,
        oldValue:  params.oldValue != null ? (params.oldValue as object) : undefined,
        newValue:  params.newValue != null ? (params.newValue as object) : undefined,
        meta:      params.meta    != null ? (params.meta    as object) : undefined,
      },
    })
  } catch {
    // Аудит не должен ломать основной поток
    console.error('[audit] Ошибка записи аудит-лога', params.entity, params.entityId)
  }
}