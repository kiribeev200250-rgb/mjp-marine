import { prisma } from '@/lib/prisma'
import type { PermissionMatrix } from '@/lib/crm/permissions'
import { hasPermission, type CrmModule, type CrmAction } from '@/lib/crm/permissions'

export interface LinkedUser {
  id:          string
  companyId:   string
  name:        string
  role:        string
  permissions: PermissionMatrix
}

// Резолвим CrmUser по Telegram ID на каждое сообщение — дешёвый запрос,
// зато всегда актуальные права/активность (в отличие от кэша в сессии).
export async function getLinkedUser(telegramId: string): Promise<LinkedUser | null> {
  const user = await prisma.crmUser.findUnique({ where: { telegramId } })
  if (!user || !user.active) return null
  return {
    id:          user.id,
    companyId:   user.companyId,
    name:        user.name,
    role:        user.role,
    permissions: user.permissions as PermissionMatrix,
  }
}

export function can(user: LinkedUser, module: CrmModule, action: CrmAction): boolean {
  return hasPermission(user.role, user.permissions, module, action)
}
