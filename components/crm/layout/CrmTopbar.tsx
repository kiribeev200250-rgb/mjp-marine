'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { QuickAddModal } from '@/components/crm/finance/QuickAddModal'
import { GlobalSearch } from '@/components/crm/layout/GlobalSearch'
import { useCrmI18n } from '@/components/crm/i18n/CrmI18nProvider'
import { CRM_LANGS, CRM_LANG_LABEL } from '@/lib/crm/i18n'

interface Props {
  userName: string
  userInitial: string
}

export function CrmTopbar({ userName, userInitial }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { t, lang, setLang } = useCrmI18n()

  return (
    <header className="h-14 bg-navy-900 border-b border-white/5 flex items-center px-5 shrink-0 gap-4">
      <GlobalSearch />

      <button
        onClick={() => setQuickAddOpen(true)}
        className="shrink-0 flex items-center gap-1.5 bg-gold text-navy-900 text-label font-bold px-3 py-1.5 rounded-control hover:bg-gold/90 transition"
      >
        {t('newOperation')}
      </button>

      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}

      {/* Right: user avatar + dropdown */}
      <div className="ml-auto relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-white/5 transition"
        >
          <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center text-gold text-label font-bold shrink-0">
            {userInitial}
          </div>
          <span className="text-white/70 text-label hidden sm:block">{userName}</span>
          <span className="text-white/55 text-label">▾</span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-navy-900 border border-white/10 rounded-card shadow-e4 py-1 min-w-[160px]">
              <div className="px-4 py-2">
                <p className="text-label text-white/40 uppercase tracking-wide mb-1.5">{t('language')}</p>
                <div className="flex gap-1.5">
                  {CRM_LANGS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={
                        'px-2 py-1 rounded text-label transition ' +
                        (lang === l ? 'bg-gold text-navy-900 font-semibold' : 'bg-white/10 text-white/70 hover:bg-white/15')
                      }
                    >
                      {CRM_LANG_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/10 mt-1" />
              <button
                onClick={() => signOut({ callbackUrl: '/crm/login' })}
                className="w-full text-left px-4 py-2 text-body text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                {t('logout')}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
