'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        ready: () => void
        expand: () => void
        setHeaderColor?: (color: string) => void
        setBackgroundColor?: (color: string) => void
        BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }
        HapticFeedback?: { impactOccurred: (style: string) => void; notificationOccurred: (type: string) => void }
      }
    }
  }
}

interface TgSessionInfo {
  linked: boolean
  telegram?: boolean
  user?: { name: string; role: 'ADMIN' | 'EMPLOYEE' }
  companyName?: string
}

interface TgContextValue {
  ready: boolean
  session: TgSessionInfo | null
  error: string | null
  inTelegram: boolean
  tgFetch: (input: string, init?: RequestInit) => Promise<Response>
  haptic: (style?: 'light' | 'medium' | 'heavy') => void
  reload: () => void
}

const TgContext = createContext<TgContextValue | null>(null)

export function useTg(): TgContextValue {
  const ctx = useContext(TgContext)
  if (!ctx) throw new Error('useTg должен использоваться внутри TgProvider')
  return ctx
}

export function TgProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<TgSessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inTelegram, setInTelegram] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const initData = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.Telegram?.WebApp?.initData ?? ''
  }, [ready])

  const tgFetch = useMemo(() => {
    return (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (initData) headers.set('X-Telegram-Init-Data', initData)
      return fetch(input, { ...init, headers })
    }
  }, [initData])

  const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
  }

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (webApp) {
      webApp.ready()
      webApp.expand()
      webApp.setHeaderColor?.('#061729')
      webApp.setBackgroundColor?.('#061729')
      setInTelegram(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    tgFetch('/api/tg/session')
      .then((res) => res.json())
      .then((data: TgSessionInfo) => {
        if (!cancelled) setSession(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось подключиться к серверу')
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reloadTick])

  const value: TgContextValue = {
    ready, session, error, inTelegram, tgFetch, haptic,
    reload: () => setReloadTick((t) => t + 1),
  }

  return <TgContext.Provider value={value}>{children}</TgContext.Provider>
}
