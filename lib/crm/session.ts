import { getServerSession } from 'next-auth'
import type { NextApiRequest, NextApiResponse } from 'next'
import { crmAuthOptions } from './auth'
import type { PermissionMatrix } from './permissions'

export interface CrmSessionUser {
  id:          string
  email:       string
  name:        string
  companyId:   string
  role:        'ADMIN' | 'EMPLOYEE'
  permissions: PermissionMatrix
  scope:       'ALL' | 'OWN_TASKS' | 'OWN_MARINA'
  marina:      string
}

export interface CrmSession {
  user: CrmSessionUser
}

// Получить сессию CRM в Server Component / Route Handler
export async function getCrmSession(): Promise<CrmSession | null> {
  const session = await getServerSession(crmAuthOptions)
  if (!session?.user) return null
  return session as unknown as CrmSession
}

// Бросает ошибку если нет сессии — использовать в защищённых server actions
export async function requireCrmSession(): Promise<CrmSession> {
  const session = await getCrmSession()
  if (!session) throw new Error('Не авторизован')
  return session
}

// Получить сессию CRM в Pages Router API route (pages/api/...).
// Используется точечно там, где код НЕ должен собираться в графе app/ —
// например, @react-pdf/renderer ломается под react-server условием резолва
// 'react' при бандлинге внутри app/api/**/route.ts (Symbol mismatch, React error #31).
export async function getCrmSessionApi(req: NextApiRequest, res: NextApiResponse): Promise<CrmSession | null> {
  const session = await getServerSession(req, res, crmAuthOptions)
  if (!session?.user) return null
  return session as unknown as CrmSession
}