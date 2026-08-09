import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { setupCompanyAction } from './actions'
import { SubmitButton } from './SubmitButton'

// Dark-background field — only for auth screens
function DarkField({
  label, name, type = 'text', required, defaultValue, minLength, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string; minLength?: number; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-white/50 text-label uppercase tracking-wide">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full bg-white/8 border border-white/15 rounded-control px-4 py-2.5 text-body text-white placeholder:text-white/25 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 transition"
      />
    </div>
  )
}

export default async function SetupPage() {
  const existing = await prisma.company.findFirst()
  if (existing) redirect('/crm/login')

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/15 border border-gold/25 mb-4">
            <span className="text-gold text-2xl">⚓</span>
          </div>
          <h1 className="text-white text-heading font-bold tracking-tight">MJP Marine CRM</h1>
          <p className="text-white/40 text-body mt-1">Первичная настройка системы</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-card p-7 shadow-e4 backdrop-blur-sm">
          <h2 className="text-white font-semibold text-subheading mb-1">
            Создание компании и администратора
          </h2>
          <p className="text-white/40 text-label mb-6">
            Выполняется один раз. Позже управляй пользователями в настройках.
          </p>

          <form action={setupCompanyAction} className="space-y-4">
            <DarkField
              label="Название компании"
              name="companyName"
              defaultValue="MJP Marine Service"
              required
            />
            <DarkField
              label="Ваше имя (администратор)"
              name="adminName"
              placeholder="Имя Фамилия"
              required
            />

            <div className="pt-1 border-t border-white/10">
              <p className="text-white/30 text-label mb-3 mt-3">Учётные данные для входа</p>
              <div className="space-y-4">
                <DarkField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="admin@mjpmarine.es"
                  required
                />
                <DarkField
                  label="Пароль (минимум 8 символов)"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
        </div>

        <p className="text-white/20 text-label text-center mt-6">
          MJP Marine Service · Costa Blanca, España
        </p>
      </div>
    </div>
  )
}