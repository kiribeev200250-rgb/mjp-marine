'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/crm/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-control transition-all ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-navy-900 hover:bg-gold-dark active:bg-gold-dark/80 focus:ring-info/40 shadow-e1',
  secondary:
    'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 ' +
    'focus:ring-info/40 shadow-e1',
  danger:
    'bg-danger text-white hover:bg-danger/90 active:bg-danger/80 focus:ring-danger/40',
  ghost:
    'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:ring-info/40',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-label px-3 py-1.5 h-7',
  md: 'text-body  px-4 py-2   h-9',
  lg: 'text-sm    px-5 py-2.5 h-11',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}