'use client'

import { SessionProvider } from 'next-auth/react'

// Провайдер сессии специфичный для CRM (отдельный basePath)
export function CrmProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/crm/auth">
      {children}
    </SessionProvider>
  )
}