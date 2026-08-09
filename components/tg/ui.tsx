'use client'

import { cn } from '@/lib/crm/utils'

export function TgCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-card shadow-e2 border border-gray-200/60 p-3',
        onClick && 'active:scale-[0.98] transition-transform cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TgButton({
  children, onClick, variant = 'primary', disabled, type = 'button', className,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const VARIANT: Record<string, string> = {
    primary:   'bg-navy text-white active:bg-navy-900',
    secondary: 'bg-gold text-navy-900 active:bg-gold-dark',
    ghost:     'bg-gray-100 text-navy-900 active:bg-gray-200',
    danger:    'bg-danger/10 text-danger active:bg-danger/20',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-control px-3 py-2 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TgKpi({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'success' }) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-navy-900'
  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-3 flex-1 min-w-[120px]">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', toneClass)}>{value}</div>
    </div>
  )
}

export function TgEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm gap-2">
      <span className="text-3xl">🗂</span>
      {text}
    </div>
  )
}

export function TgSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
    </div>
  )
}

export function TgInput({
  value, onChange, placeholder, type = 'text', className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={cn(
        'w-full rounded-control border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold',
        className,
      )}
    />
  )
}

export function TgSelect({
  value, onChange, options, className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full rounded-control border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold',
        className,
      )}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
