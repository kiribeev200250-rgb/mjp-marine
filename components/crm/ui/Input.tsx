import { forwardRef } from 'react'
import { cn } from '@/lib/crm/utils'

// ── Input ─────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:    string
  error?:    string
  suffix?:   string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, suffix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-label text-gray-500 uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-control border bg-white px-3 py-2 text-body text-gray-900',
              'placeholder:text-gray-500/50 shadow-e1 transition',
              'focus:outline-none focus:ring-2 focus:ring-info/40 focus:ring-offset-1 focus:border-info',
              'disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500',
              error ? 'border-danger' : 'border-gray-200',
              suffix ? 'pr-8' : '',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-body select-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ── Select ────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:    string
  error?:    string
  children:  React.ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-label text-gray-500 uppercase tracking-wide">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-control border bg-white px-3 py-2 text-body text-gray-900 shadow-e1 transition',
            'focus:outline-none focus:ring-2 focus:ring-info/40 focus:ring-offset-1 focus:border-info',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            error ? 'border-danger' : 'border-gray-200',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

// ── Textarea ──────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:    string
  error?:    string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const areaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={areaId} className="block text-label text-gray-500 uppercase tracking-wide">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            'w-full rounded-control border bg-white px-3 py-2 text-body text-gray-900 shadow-e1 transition resize-none',
            'placeholder:text-gray-500/50',
            'focus:outline-none focus:ring-2 focus:ring-info/40 focus:ring-offset-1 focus:border-info',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            error ? 'border-danger' : 'border-gray-200',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'