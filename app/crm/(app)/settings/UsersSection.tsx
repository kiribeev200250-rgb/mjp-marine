'use client'

import { useState } from 'react'

interface User {
  id:         string
  name:       string
  email:      string
  role:       string
  active:     boolean
  createdAt:  Date
  telegramId: string | null
}

interface Props {
  companyId: string
  users:     User[]
}

export function UsersSection({ companyId, users }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [codeFor,  setCodeFor]  = useState<{ userId: string; code: string } | null>(null)
  const [tgBusy,   setTgBusy]   = useState<string | null>(null)
  const [linked,   setLinked]   = useState<Record<string, boolean>>(
    Object.fromEntries(users.map((u) => [u.id, !!u.telegramId])),
  )

  async function handleGetCode(userId: string) {
    setTgBusy(userId)
    const res = await fetch('/api/crm/settings/telegram-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    setTgBusy(null)
    if (res.ok) {
      const data = await res.json()
      setCodeFor({ userId, code: data.code })
    }
  }

  async function handleUnlink(userId: string) {
    setTgBusy(userId)
    const res = await fetch('/api/crm/settings/telegram-link', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    setTgBusy(null)
    if (res.ok) setLinked((prev) => ({ ...prev, [userId]: false }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const res  = await fetch('/api/crm/settings/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        companyId,
        name:     form.get('name'),
        email:    form.get('email'),
        password: form.get('password'),
        role:     form.get('role'),
      }),
    })

    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      window.location.reload()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Ошибка создания пользователя')
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Таблица пользователей */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-white/40 font-medium text-left px-5 py-3">Имя</th>
            <th className="text-white/40 font-medium text-left px-5 py-3">Email</th>
            <th className="text-white/40 font-medium text-left px-5 py-3">Роль</th>
            <th className="text-white/40 font-medium text-left px-5 py-3">Статус</th>
            <th className="text-white/40 font-medium text-left px-5 py-3">Telegram</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-white/5 last:border-0">
              <td className="text-white px-5 py-3">{u.name}</td>
              <td className="text-white/60 px-5 py-3">{u.email}</td>
              <td className="px-5 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.role === 'ADMIN'
                    ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                    : 'bg-[#2980B9]/15 text-[#2980B9]'
                }`}>
                  {u.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}
                </span>
              </td>
              <td className="px-5 py-3">
                <span className={`text-xs ${u.active ? 'text-[#27AE60]' : 'text-white/30'}`}>
                  {u.active ? 'Активен' : 'Отключён'}
                </span>
              </td>
              <td className="px-5 py-3">
                {codeFor?.userId === u.id ? (
                  <span className="text-xs text-[#C9A84C]">
                    Код: <b className="font-mono">{codeFor.code}</b> — отправить боту: <code>/link {codeFor.code}</code> (15 мин)
                  </span>
                ) : linked[u.id] ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#27AE60]">✓ Привязан</span>
                    <button
                      onClick={() => handleUnlink(u.id)}
                      disabled={tgBusy === u.id}
                      className="text-xs text-white/30 hover:text-[#C0392B] transition"
                    >
                      отвязать
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGetCode(u.id)}
                    disabled={tgBusy === u.id}
                    className="text-xs text-[#C9A84C] hover:text-[#E8C96A] transition disabled:opacity-50"
                  >
                    {tgBusy === u.id ? '...' : 'Получить код'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Кнопка добавить */}
      <div className="px-5 py-4 border-t border-white/5">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-[#C9A84C] hover:text-[#E8C96A] text-sm font-medium transition"
          >
            + Добавить сотрудника
          </button>
        ) : (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input name="name"     required placeholder="Имя"     className={input} autoComplete="off" />
            <input name="email"    required type="email" placeholder="Email" className={input} autoComplete="off" />
            <input name="password" required type="password" placeholder="Пароль (мин. 8 символов)" minLength={8} className={input} autoComplete="new-password" />
            <select name="role" className={input}>
              <option value="EMPLOYEE">Сотрудник</option>
              <option value="ADMIN">Администратор</option>
            </select>

            {error && (
              <p className="sm:col-span-2 text-[#C0392B] text-xs">{error}</p>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#C9A84C] hover:bg-[#E8C96A] disabled:opacity-50 text-[#0A2342] font-bold px-4 py-2 rounded-lg text-sm transition"
              >
                {saving ? 'Создаём...' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="text-white/40 hover:text-white text-sm transition"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const input = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] transition w-full'