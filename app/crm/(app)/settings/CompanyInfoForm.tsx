'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyInfo } from '@prisma/client'
import { Input, Button } from '@/components/crm/ui'

interface Props { companyId: string; data: CompanyInfo | null }

export function CompanyInfoForm({ companyId, data }: Props) {
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  const isPlaceholder = data?.legalName === 'ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setSuccess(false); setError('')
    const body = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res  = await fetch('/api/crm/settings/company-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ companyId, ...body }),
    })
    setSaving(false)
    if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000) }
    else         setError('Ошибка сохранения')
  }

  return (
    <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-6 space-y-6">
      {isPlaceholder && (
        <div className="bg-warning/10 border border-warning/30 rounded-control px-4 py-3 text-body text-warning">
          ⚠ Реквизиты не заполнены — счета нельзя выпускать до заполнения NIF и адреса.
          <br />
          <span className="text-gray-500 text-label">Сверьтесь с gestором (бухгалтером) перед первым выставлением счёта.</span>
        </div>
      )}

      <LogoUploader companyId={companyId} logoUrl={data?.logoUrl ?? null} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Юридическое название" name="legalName" defaultValue={data?.legalName ?? ''} />
        <Field label="NIF / CIF"            name="nif"       defaultValue={data?.nif       ?? ''} />
        <Field label="Адрес"                name="address"   defaultValue={data?.address   ?? ''} />
        <Field label="Город"                name="city"      defaultValue={data?.city      ?? ''} />
        <Field label="Почтовый индекс"      name="postalCode" defaultValue={data?.postalCode ?? ''} />
        <Field label="Страна"               name="country"   defaultValue={data?.country   ?? 'España'} />
        <Field label="Email компании"       name="email"     defaultValue={data?.email     ?? ''} type="email" />
        <Field label="Телефон"              name="phone"     defaultValue={data?.phone     ?? ''} />
        <div className="md:col-span-2">
          <Field label="IBAN" name="bankAccount" defaultValue={data?.bankAccount ?? ''} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ставка IVA (%)"  name="ivaRate"  defaultValue={data?.ivaRate?.toString()  ?? '21'} type="number" />
          <Field label="Ставка IRPF (%)" name="irpfRate" defaultValue={data?.irpfRate?.toString() ?? '0'}  type="number" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Префикс счётов"   name="invoicePrefix" defaultValue={data?.invoicePrefix ?? 'F'} />
          <Field label="Префикс пресметов" name="quotePrefix"  defaultValue={data?.quotePrefix   ?? 'P'} />
        </div>

        <div className="md:col-span-2 flex items-center gap-4 pt-2">
          <Button type="submit" loading={saving}>Сохранить</Button>
          {success && <span className="text-success text-body">Сохранено ✓</span>}
          {error   && <span className="text-danger text-body">{error}</span>}
        </div>
      </form>
    </div>
  )
}

function LogoUploader({ companyId, logoUrl }: { companyId: string; logoUrl: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing,  setRemoving]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true); setError(null)
    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/crm/settings/logo', { method: 'POST', body: form })
    setUploading(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка загрузки')
      return
    }
    router.refresh()
  }

  async function handleRemove() {
    setRemoving(true); setError(null)
    const res = await fetch('/api/crm/settings/logo', { method: 'DELETE' })
    setRemoving(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка удаления')
      return
    }
    router.refresh()
  }

  return (
    <div>
      <label className="block text-label text-gray-500 uppercase tracking-wide mb-2">Логотип компании</label>
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-control border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Логотип" className="w-full h-full object-contain" />
          ) : (
            <span className="text-gray-300 text-[10px] text-center px-2">Нет логотипа</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
              {logoUrl ? 'Заменить' : 'Загрузить'}
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove} loading={removing}>
                Удалить
              </Button>
            )}
          </div>
          <p className="text-gray-500 text-label">
            PNG с прозрачным фоном — попадёт в шапку PDF счетов и смет. Также PNG/WEBP/JPEG/SVG, до 4МБ.
          </p>
          {error && <p className="text-danger text-label">{error}</p>}
        </div>

        <input ref={inputRef} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

function Field({ label, name, defaultValue, type = 'text' }: {
  label: string; name: string; defaultValue: string; type?: string
}) {
  return <Input label={label} name={name} type={type} defaultValue={defaultValue} />
}