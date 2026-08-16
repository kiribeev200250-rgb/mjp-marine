import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Единственный внешний вход, который трогают все эти роуты перед проверкой
// прав, — getCrmSession(). Мокаем его один раз здесь: без сессии → должно
// быть 401, с сессией без нужного права → 403. Ни то, ни другое не должно
// доходить до Prisma — если дойдёт, тест либо упадёт с ошибкой подключения,
// либо (что хуже) молча вернёт 200 с чужими данными.
vi.mock('@/lib/crm/session', () => ({
  getCrmSession: vi.fn(),
}))

import { getCrmSession } from '@/lib/crm/session'

const mockedGetSession = vi.mocked(getCrmSession)

const EMPLOYEE_NO_PERMS = {
  user: {
    id: 'test-user', email: 'test@example.com', name: 'Test', companyId: 'test-company',
    role: 'EMPLOYEE' as const, permissions: {}, scope: 'ALL' as const, marina: '',
  },
}

function req(url = 'http://localhost/api/test') {
  return new NextRequest(url)
}

// module — модуль CrmModule (для описания теста), loader — динамический
// импорт роута (внутри describe, чтобы мок сессии уже был на месте), method —
// какой экспортированный хендлер дёргаем.
const routes: { module: string; path: string; loader: () => Promise<Record<string, (req: NextRequest) => Promise<Response>>>; method: string }[] = [
  { module: 'CLIENTS',   path: 'app/api/crm/clients/route.ts',              loader: () => import('@/app/api/crm/clients/route'),              method: 'GET' },
  { module: 'FUNNEL',    path: 'app/api/crm/funnel/route.ts',               loader: () => import('@/app/api/crm/funnel/route'),               method: 'GET' },
  { module: 'SCHEDULE',  path: 'app/api/crm/tasks/route.ts',                loader: () => import('@/app/api/crm/tasks/route'),                method: 'GET' },
  { module: 'INVENTORY', path: 'app/api/crm/inventory/route.ts',            loader: () => import('@/app/api/crm/inventory/route'),            method: 'GET' },
  { module: 'FINANCE',   path: 'app/api/crm/finance/route.ts',              loader: () => import('@/app/api/crm/finance/route'),              method: 'GET' },
  { module: 'INVOICES',  path: 'app/api/crm/invoices/route.ts',             loader: () => import('@/app/api/crm/invoices/route'),             method: 'GET' },
  { module: 'PROJECTS',  path: 'app/api/crm/projects/route.ts',             loader: () => import('@/app/api/crm/projects/route'),             method: 'GET' },
  { module: 'REPORTS',   path: 'app/api/crm/reports/gestor-export/route.ts', loader: () => import('@/app/api/crm/reports/gestor-export/route'), method: 'GET' },
  { module: 'SETTINGS',  path: 'app/api/crm/settings/users/route.ts',       loader: () => import('@/app/api/crm/settings/users/route'),       method: 'POST' },
]

describe('unauthorized access — every protected module', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
  })

  for (const { module, path, loader, method } of routes) {
    describe(`${module} (${path})`, () => {
      it('returns 401 with no session', async () => {
        mockedGetSession.mockResolvedValue(null)
        const mod = await loader()
        const handler = mod[method]
        const res = await handler(req())
        expect(res.status).toBe(401)
      })

      it('returns 403 for a logged-in user without the required permission', async () => {
        mockedGetSession.mockResolvedValue(EMPLOYEE_NO_PERMS)
        const mod = await loader()
        const handler = mod[method]
        const res = await handler(req())
        expect(res.status).toBe(403)
      })
    })
  }
})
