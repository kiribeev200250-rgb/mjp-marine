'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

// Dark-background field — used only on auth screens (can't use light <Input> here)
function DarkField({
  label, type = 'text', ...props
}: { label: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-white/50 text-label uppercase tracking-wide">{label}</label>
      <input
        type={type}
        className="w-full bg-white/8 border border-white/15 rounded-control px-4 py-2.5 text-body text-white placeholder:text-white/25 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 focus:ring-offset-0 transition"
        {...props}
      />
    </div>
  )
}

function LoginForm() {
  const router    = useRouter()
  const params    = useSearchParams()
  const setupDone = params?.get('setup') === 'done'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn('credentials', {
      email, password, redirect: false, callbackUrl: '/crm/dashboard',
    })
    setLoading(false)
    if (result?.error) { setError('Неверный email или пароль'); return }
    router.push('/crm/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/15 border border-gold/25 mb-4">
            <span className="text-gold text-2xl">⚓</span>
          </div>
          <h1 className="text-white text-heading font-bold tracking-tight">MJP Marine CRM</h1>
          <p className="text-white/40 text-body mt-1">Внутренняя система управления</p>
        </div>

        {/* Setup success banner */}
        {setupDone && (
          <div className="flex items-center gap-2 bg-success/15 border border-success/25 text-white rounded-card px-4 py-3 text-body mb-5">
            <span className="text-success">✓</span>
            Компания создана. Войдите в систему.
          </div>
        )}

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-card p-7 shadow-e4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DarkField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@mjpmarine.es"
            />
            <DarkField
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            {error && (
              <div className="bg-danger/15 border border-danger/25 rounded-control px-3 py-2 text-danger text-body text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gold hover:bg-gold-light disabled:opacity-60 disabled:cursor-not-allowed text-navy font-semibold rounded-control px-4 py-2.5 text-body transition focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-navy-900"
            >
              {loading ? 'Вхожу…' : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-white/20 text-label text-center mt-6">
          MJP Marine Service · Costa Blanca, España
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}