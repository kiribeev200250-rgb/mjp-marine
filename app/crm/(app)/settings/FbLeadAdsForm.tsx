'use client'

import { useState } from 'react'
import type { CompanyInfo } from '@prisma/client'
import { Input, Button } from '@/components/crm/ui'

interface Props { data: CompanyInfo | null }

export function FbLeadAdsForm({ data }: Props) {
  const [enabled, setEnabled] = useState(data?.fbEnabled ?? false)
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setSuccess(false); setError('')
    const form = new FormData(e.currentTarget)
    const res  = await fetch('/api/crm/settings/fb-lead-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fbEnabled:     enabled,
        fbAppId:       form.get('fbAppId'),
        fbPageToken:   form.get('fbPageToken'),
        fbVerifyToken: form.get('fbVerifyToken'),
      }),
    })
    setSaving(false)
    if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000) }
    else         setError('Ошибка сохранения')
  }

  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-6">
      <div className="bg-info/10 border border-info/30 rounded-control px-4 py-3 mb-5 text-body text-gray-700">
        Webhook: <code className="text-label bg-white px-1.5 py-0.5 rounded border border-gray-200">/api/crm/webhook/facebook</code>
        <br />
        <span className="text-gray-500 text-label">
          Пока выключено — лиды не создаются. Заполните поля из Facebook App Dashboard (Webhooks → Page Subscriptions → leadgen) и включите переключатель.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold/40"
          />
          <span className="text-body text-gray-900 font-medium">Включить приём лидов с Facebook</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="FB App ID"          name="fbAppId"       defaultValue={data?.fbAppId       ?? ''} autoComplete="off" />
          <Input label="Verify Token"       name="fbVerifyToken" defaultValue={data?.fbVerifyToken ?? ''} placeholder="случайная строка для верификации" autoComplete="off" />
          <div className="md:col-span-2">
            <Input label="Page Access Token" name="fbPageToken" type="password" defaultValue={data?.fbPageToken ?? ''} autoComplete="new-password" />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <Button type="submit" loading={saving}>Сохранить</Button>
          {success && <span className="text-success text-body">Сохранено ✓</span>}
          {error   && <span className="text-danger text-body">{error}</span>}
        </div>
      </form>
    </div>
  )
}
