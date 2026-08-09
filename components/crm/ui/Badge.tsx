import { cn } from '@/lib/crm/utils'

export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

interface Props {
  tone:       BadgeTone
  children:   React.ReactNode
  className?: string
}

const TONE: Record<BadgeTone, string> = {
  success: 'bg-success/10 text-success',
  info:    'bg-info/10    text-info',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10  text-danger',
  neutral: 'bg-gray-50    text-gray-500 border border-gray-200',
}

export function Badge({ tone, children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-chip',
        'text-label font-semibold uppercase tracking-wide',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ── Маппинги статусов ─────────────────────────────────────────────────────

export const FUNNEL_TONE: Record<string, BadgeTone> = {
  NEW_LEAD:       'info',
  CONTACT_MADE:   'info',
  QUOTE_SENT:     'neutral',
  WORK_SCHEDULED: 'info',
  WORK_DONE:      'success',
  INVOICE_SENT:   'warning',
  PAID:           'success',
}

export const TASK_TONE: Record<string, BadgeTone> = {
  NEW:         'neutral',
  SCHEDULED:   'info',
  IN_PROGRESS: 'warning',
  DONE:        'success',
  PROBLEM:     'danger',
}

export const INVOICE_TONE: Record<string, BadgeTone> = {
  ISSUED:    'info',
  PARTIAL:   'warning',
  PAID:      'success',
  OVERDUE:   'danger',
  CANCELLED: 'neutral',
}

export const QUOTE_TONE: Record<string, BadgeTone> = {
  DRAFT:    'neutral',
  SENT:     'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
}