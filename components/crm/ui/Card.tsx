import { cn } from '@/lib/crm/utils'

// ── Базовая карточка ──────────────────────────────────────────────────────

interface CardProps {
  children:   React.ReactNode
  className?: string
  padding?:   boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-card shadow-e2 border border-gray-200/60',
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ── KPI-карточка ──────────────────────────────────────────────────────────

type DeltaTone = 'success' | 'danger' | 'neutral'

interface KpiCardProps {
  label:      string
  value:      React.ReactNode
  delta?:     string
  deltaTone?: DeltaTone
  icon?:      React.ReactNode
  href?:      string
  className?: string
}

const DELTA_COLOR: Record<DeltaTone, string> = {
  success: 'text-success',
  danger:  'text-danger',
  neutral: 'text-gray-500',
}

export function KpiCard({ label, value, delta, deltaTone = 'neutral', icon, className }: KpiCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-heading text-gray-900 tabular-nums">{value}</p>
          {delta && (
            <p className={cn('text-label mt-1', DELTA_COLOR[deltaTone])}>{delta}</p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 text-gray-500 text-2xl">{icon}</div>
        )}
      </div>
    </Card>
  )
}

// ── Section Header (для внутренних секций карточки) ───────────────────────

interface SectionHeaderProps {
  title:      string
  action?:    React.ReactNode
  className?: string
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <h3 className="text-label text-gray-500 uppercase tracking-wide">{title}</h3>
      {action}
    </div>
  )
}