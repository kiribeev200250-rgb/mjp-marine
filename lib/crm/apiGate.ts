import { NextResponse } from 'next/server'
import { getCrmSession, type CrmSession } from './session'
import { hasPermission, type CrmModule, type CrmAction } from './permissions'

export type CrmGateResult = { session: CrmSession } | { error: NextResponse }

// Единая точка входа для защиты app/api/crm/** роутов — получает сессию и
// сразу проверяет право «модуль × действие» одним вызовом. Раньше это были
// два отдельных шага (getCrmSession + requirePermission), и requirePermission
// бросал исключение — Next.js Route Handlers ничего не ловят вокруг тела
// хендлера, так что недостаточно прав отдавалось клиенту как 500, а не 403
// (найдено и подтверждено вживую при аудите; починено по всем существующим
// роутам). Новые роуты — использовать так, вместо повторения этих двух
// шагов руками:
//
//   const gate = await requireCrmAccess('FINANCE', 'CREATE')
//   if ('error' in gate) return gate.error
//   const { session } = gate
export async function requireCrmAccess(module: CrmModule, action: CrmAction): Promise<CrmGateResult> {
  const session = await getCrmSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }) }
  }
  if (!hasPermission(session.user.role, session.user.permissions, module, action)) {
    return { error: NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 }) }
  }
  return { session }
}
