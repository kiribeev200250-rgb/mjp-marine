'use client'

import Link from 'next/link'
import { useTg } from '@/components/tg/TgProvider'
import { TgCard, TgSpinner } from '@/components/tg/ui'

const MODULES = [
  { href: '/tg/funnel', label: 'Воронка продаж', desc: 'Клиенты по стадиям, канбан', icon: '🔀' },
  { href: '/tg/tasks', label: 'Задачи и планировщик', desc: 'Сегодня и бэклог', icon: '🗓' },
  { href: '/tg/warehouse', label: 'Склад', desc: 'Остатки, приход, списание', icon: '📦' },
  { href: '/tg/finance', label: 'Финансы', desc: 'Касса, P&L, операции', icon: '💶' },
  { href: '/tg/invoices', label: 'Дебиторка', desc: 'Неоплаченные счета', icon: '🧾' },
] as const

export default function TgHomePage() {
  const { ready, session, error } = useTg()

  if (!ready || (ready && session === null && !error)) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <TgSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-6 text-center">
        <p className="text-white/70 text-sm">{error}</p>
      </div>
    )
  }

  if (session && !session.linked) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6 text-center gap-3">
        <span className="text-4xl">🔒</span>
        <p className="text-white font-semibold">Аккаунт не привязан</p>
        <p className="text-white/60 text-sm">
          {session.telegram
            ? 'Ваш Telegram-аккаунт не связан ни с одним пользователем CRM. Обратитесь к администратору — привязать можно в настройках CRM или командой /link в боте.'
            : 'Откройте приложение через Telegram-бота или войдите в CRM в браузере.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <div className="px-5 pt-8 pb-6">
        <div className="text-white/50 text-xs uppercase tracking-wide">{session?.companyName ?? 'MJP Marine'}</div>
        <div className="text-white text-xl font-semibold mt-0.5">Привет, {session?.user?.name ?? '—'}</div>
        <div className="text-white/40 text-xs mt-0.5">{session?.user?.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}</div>
      </div>

      <div className="bg-gray-50 rounded-t-[24px] flex-1 px-4 pt-5 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}>
              <TgCard className="h-full flex flex-col gap-1.5" onClick={() => {}}>
                <span className="text-2xl">{m.icon}</span>
                <span className="text-sm font-semibold text-navy-900 leading-tight">{m.label}</span>
                <span className="text-xs text-gray-500 leading-tight">{m.desc}</span>
              </TgCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
