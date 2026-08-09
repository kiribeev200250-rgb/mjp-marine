'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/crm/utils'

const NAV_ITEMS = [
  { href: '/tg', label: 'Главная', icon: '🏠' },
  { href: '/tg/funnel', label: 'Воронка', icon: '🔀' },
  { href: '/tg/tasks', label: 'Задачи', icon: '🗓' },
  { href: '/tg/warehouse', label: 'Склад', icon: '📦' },
  { href: '/tg/finance', label: 'Финансы', icon: '💶' },
] as const

export function TgShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-navy-900 text-white px-4 py-3 shadow-e2">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      <main className="flex-1 pb-20 px-3 pt-3">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-navy-900 border-t border-white/10 flex justify-around py-1.5 shadow-e4">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/tg' ? pathname === '/tg' : pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-control text-[11px] min-w-[56px]',
                active ? 'text-gold' : 'text-white/60',
              )}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
