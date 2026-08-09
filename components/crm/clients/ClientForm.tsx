'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Select, Textarea, Button } from '@/components/crm/ui'

const SOURCES = ['FACEBOOK', 'MANUAL', 'REFERRAL', 'WEBSITE', 'WHATSAPP', 'OTHER']
const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook', MANUAL: 'Вручную', REFERRAL: 'Рекомендация',
  WEBSITE: 'Сайт', WHATSAPP: 'WhatsApp', OTHER: 'Другое',
}
const MARINAS = [
  'Dénia', 'Jávea (Xàbia)', 'Calpe (Calp)', 'Altea', 'Benidorm',
  'Villajoyosa', 'El Campello', 'Alicante', 'Santa Pola', 'Torrevieja',
  'Guardamar', 'Cartagena', 'Mazarrón', 'Другая',
]
const LANGUAGES = [
  { value: 'ru', label: 'Русский'    },
  { value: 'uk', label: 'Украинский' },
  { value: 'en', label: 'English'    },
  { value: 'es', label: 'Español'    },
  { value: 'pl', label: 'Polski'     },
]

interface Props {
  initialData?: {
    firstName?: string; lastName?: string; phone?: string; email?: string
    marina?: string; source?: string; language?: string; notes?: string
  }
  clientId?: string
}

export function ClientForm({ initialData, clientId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [form, setForm] = useState({
    firstName: initialData?.firstName ?? '',
    lastName:  initialData?.lastName  ?? '',
    phone:     initialData?.phone     ?? '',
    email:     initialData?.email     ?? '',
    marina:    initialData?.marina    ?? '',
    source:    initialData?.source    ?? 'MANUAL',
    language:  initialData?.language  ?? 'ru',
    notes:     initialData?.notes     ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim()) { setError('Имя обязательно'); return }
    setSaving(true); setError('')

    const res = await fetch(
      clientId ? `/api/crm/clients/${clientId}` : '/api/crm/clients',
      { method: clientId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) },
    )
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Ошибка сохранения'); return }
    const data = await res.json()
    router.push(`/crm/clients/${data.id ?? clientId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-6 space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Имя *" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
        <Input label="Фамилия" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        <Input label="Телефон" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />

        <Select label="Марина" value={form.marina} onChange={(e) => set('marina', e.target.value)}>
          <option value="">— Не указана —</option>
          {MARINAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>

        <Select label="Источник" value={form.source} onChange={(e) => set('source', e.target.value)}>
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </Select>

        <Select label="Язык клиента" value={form.language} onChange={(e) => set('language', e.target.value)}>
          {LANGUAGES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      <Textarea label="Заметки" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />

      {error && <p className="text-danger text-body">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="submit" loading={saving}>
          {clientId ? 'Сохранить' : 'Добавить клиента'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  )
}