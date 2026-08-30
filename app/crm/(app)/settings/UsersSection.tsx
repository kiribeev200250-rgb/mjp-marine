'use client'

import { useState } from 'react'
import { Input, Select, Button, Badge } from '@/components/crm/ui'

interface User {
  id:         string
  name:       string
  email:      string
  role:       string
  active:     boolean
  createdAt:  Date
  telegramId: string | null
  scope:      string
  marina:     string
}

interface Props {
  companyId: string
  users:     User[]
}

const SCOPE_LABEL: Record<string, string> = {
  ALL:        'Всё',
  OWN_TASKS:  'Только свои задачи',
  OWN_MARINA: 'Только своя марина',
}

export function UsersSection({ companyId, users }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [codeFor,  setCodeFor]  = useState<{ userId: string; code: string } | null>(null)
  const [tgBusy,   setTgBusy]   = useState<string | null>(null)
  const [scope,    setScope]    = useState('ALL')
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
        scope:    form.get('scope'),
        marina:   form.get('marina'),
      }),
    })

    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setScope('ALL')
      window.location.reload()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Ошибка создания пользователя')
    }
  }

  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
      {/* Таблица пользователей */}
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Имя</th>
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Email</th>
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Роль</th>
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Статус</th>
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Область видимости</th>
            <th className="text-gray-500 font-medium text-left px-5 py-3 text-label uppercase tracking-wide">Telegram</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-gray-100 last:border-0">
              <td className="text-gray-900 px-5 py-3">{u.name}</td>
              <td className="text-gray-500 px-5 py-3">{u.email}</td>
              <td className="px-5 py-3">
                <Badge tone={u.role === 'ADMIN' ? 'warning' : 'info'}>
                  {u.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <span className={`text-label font-medium ${u.active ? 'text-success' : 'text-gray-500'}`}>
                  {u.active ? 'Активен' : 'Отключён'}
                </span>
              </td>
              <td className="px-5 py-3 text-label text-gray-500">
                {u.role === 'ADMIN' ? 'Всё' : SCOPE_LABEL[u.scope] ?? u.scope}
                {u.role !== 'ADMIN' && u.scope === 'OWN_MARINA' && u.marina && ` (${u.marina})`}
              </td>
              <td className="px-5 py-3">
                {codeFor?.userId === u.id ? (
                  <span className="text-label text-gold-dark">
                    Код: <b className="font-mono">{codeFor.code}</b> — отправить боту: <code>/link {codeFor.code}</code> (15 мин)
                  </span>
                ) : linked[u.id] ? (
                  <div className="flex items-center gap-2">
                    <span className="text-label text-success">✓ Привязан</span>
                    <button
                      onClick={() => handleUnlink(u.id)}
                      disabled={tgBusy === u.id}
                      className="text-label text-gray-500 hover:text-danger transition"
                    >
                      отвязать
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGetCode(u.id)}
                    disabled={tgBusy === u.id}
                    className="text-label text-gold-dark hover:text-gold transition disabled:opacity-50"
                  >
                    {tgBusy === u.id ? '...' : 'Получить код'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Кнопка добавить */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/50">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-gold-dark hover:text-gold text-sm font-medium transition"
          >
            + Добавить сотрудника
          </button>
        ) : (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="name"     required placeholder="Имя"     autoComplete="off" />
            <Input name="email"    required type="email" placeholder="Email" autoComplete="off" />
            <Input name="password" required type="password" placeholder="Пароль (мин. 8 символов)" minLength={8} autoComplete="new-password" />
            <Select name="role">
              <option value="EMPLOYEE">Сотрудник</option>
              <option value="ADMIN">Администратор</option>
            </Select>
            <Select name="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ALL">Видит всё (как раньше)</option>
              <option value="OWN_TASKS">Только свои задачи</option>
              <option value="OWN_MARINA">Только своя марина</option>
            </Select>
            {scope === 'OWN_MARINA' && (
              <Input name="marina" required placeholder="Название марины" autoComplete="off" />
            )}

            {error && (
              <p className="sm:col-span-2 text-danger text-label">{error}</p>
            )}

            <div className="sm:col-span-2 flex gap-3 items-center">
              <Button type="submit" loading={saving}>Создать</Button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="text-gray-500 hover:text-gray-900 text-sm transition"
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
