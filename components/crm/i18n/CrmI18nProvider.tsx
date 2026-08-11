'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { CRM_DICT, CRM_LANG_STORAGE_KEY, type CrmLang } from '@/lib/crm/i18n'

interface CrmI18nValue {
  lang: CrmLang
  setLang: (lang: CrmLang) => void
  t: (key: string) => string
}

const CrmI18nContext = createContext<CrmI18nValue | null>(null)

export function CrmI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<CrmLang>('ru')

  useEffect(() => {
    const stored = localStorage.getItem(CRM_LANG_STORAGE_KEY) as CrmLang | null
    if (stored === 'ru' || stored === 'es') setLangState(stored)
  }, [])

  function setLang(next: CrmLang) {
    setLangState(next)
    localStorage.setItem(CRM_LANG_STORAGE_KEY, next)
  }

  function t(key: string): string {
    return CRM_DICT[lang][key] ?? CRM_DICT.ru[key] ?? key
  }

  return <CrmI18nContext.Provider value={{ lang, setLang, t }}>{children}</CrmI18nContext.Provider>
}

export function useCrmI18n(): CrmI18nValue {
  const ctx = useContext(CrmI18nContext)
  if (!ctx) throw new Error('useCrmI18n должен использоваться внутри CrmI18nProvider')
  return ctx
}
