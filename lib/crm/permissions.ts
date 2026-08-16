// Матрица прав RBAC: модуль × действие
// Проверка на сервере обязательна — UI лишь прячет недоступное

export type CrmModule =
  | 'CLIENTS'
  | 'FUNNEL'
  | 'SCHEDULE'
  | 'INVENTORY'
  | 'FINANCE'
  | 'INVOICES'
  | 'PROJECTS'
  | 'REPORTS'
  | 'SETTINGS'

export type CrmAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE'

export type PermissionMatrix = Partial<Record<CrmModule, CrmAction[]>>

// Полный доступ для администратора
export const ADMIN_PERMISSIONS: PermissionMatrix = {
  CLIENTS:   ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  FUNNEL:    ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  SCHEDULE:  ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  INVENTORY: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  FINANCE:   ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  INVOICES:  ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  PROJECTS:  ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  REPORTS:   ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  SETTINGS:  ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
}

export function hasPermission(
  role: string,
  permissions: PermissionMatrix,
  module: CrmModule,
  action: CrmAction,
): boolean {
  if (role === 'ADMIN') return true
  return (permissions[module] ?? []).includes(action)
}

// Бросает ошибку если прав нет — использовать в server actions / route handlers
export function requirePermission(
  role: string,
  permissions: PermissionMatrix,
  module: CrmModule,
  action: CrmAction,
): void {
  if (!hasPermission(role, permissions, module, action)) {
    throw new Error(`Недостаточно прав: ${module}.${action}`)
  }
}