'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/crm/utils'

interface NavItem { href: string; icon: string; label: string }

const NAV_ITEMS: NavItem[] = [
  { href: '/crm/dashboard',   icon: '◉',  label: 'Дашборд'     },
  { href: '/crm/clients',     icon: '👥', label: 'Клиенты'     },
  { href: '/crm/funnel',      icon: '⇒',  label: 'Воронка'     },
  { href: '/crm/schedule',    icon: '📅', label: 'Планировщик' },
  { href: '/crm/inventory',   icon: '📦', label: 'Склад'       },
  { href: '/crm/finance',     icon: '💶', label: 'Финансы'     },
  { href: '/crm/invoices',    icon: '🧾', label: 'Счета'       },
  { href: '/crm/reports',     icon: '📊', label: 'Аналитика'   },
]

interface Props { companyName: string; userName: string; roleLabel?: string }

export function CrmSidebar({ companyName, userName, roleLabel = 'Сотрудник' }: Props) {
  const pathname = usePathname() ?? ''

  const navLink = (href: string) => cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-all',
    pathname === href || pathname.startsWith(href + '/')
      ? 'bg-gold/15 text-gold font-semibold'
      : 'text-white/50 hover:text-white hover:bg-white/5',
  )

  return (
    <aside className="w-60 h-screen bg-navy-900 flex flex-col border-r border-white/5 shrink-0">
      {/* Логотип */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-gold text-2xl">⚓</span>
          <div>
            <div className="text-white font-semibold text-subheading leading-tight">{companyName}</div>
            <div className="text-white/60 text-label">CRM</div>
          </div>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className={navLink(item.href)}>
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold" />}
            </Link>
          )
        })}
      </nav>

      {/* Нижний блок */}
      <div className="border-t border-white/5 p-3 space-y-0.5">
        <Link href="/crm/settings" className={navLink('/crm/settings')}>
          <span className="w-5 text-center">⚙</span>
          <span>Настройки</span>
        </Link>
        <Link href="/crm/style-guide" className={navLink('/crm/style-guide')}>
          <span className="w-5 text-center">🎨</span>
          <span>Style Guide</span>
        </Link>

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center text-gold text-label font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white/80 text-label font-medium truncate">{userName}</div>
            <div className="text-white/55 text-label">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}