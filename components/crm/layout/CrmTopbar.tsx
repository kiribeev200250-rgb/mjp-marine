'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { QuickAddModal } from '@/components/crm/finance/QuickAddModal'

interface Props {
  userName: string
  userInitial: string
}

export function CrmTopbar({ userName, userInitial }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <header className="h-14 bg-navy-900 border-b border-white/5 flex items-center px-5 shrink-0 gap-4">
      {/* Search */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 text-body select-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="Поиск клиентов, счетов, задач…"
            className="w-full bg-white/7 border border-white/10 rounded-control pl-8 pr-4 py-1.5 text-label text-white placeholder:text-white/45 focus:outline-none focus:border-white/20 focus:bg-white/10 transition"
          />
        </div>
      </div>

      <button
        onClick={() => setQuickAddOpen(true)}
        className="shrink-0 flex items-center gap-1.5 bg-gold text-navy-900 text-label font-bold px-3 py-1.5 rounded-control hover:bg-gold/90 transition"
      >
        + Операция
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
            <div className="absolute right-0 top-full mt-1 z-20 bg-navy-900 border border-white/10 rounded-card shadow-e4 py-1 min-w-[140px]">
              <button
                onClick={() => signOut({ callbackUrl: '/crm/login' })}
                className="w-full text-left px-4 py-2 text-body text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                Выйти
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}