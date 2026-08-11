'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  taskId:       string
  photosBefore: string[]
  photosAfter:  string[]
}

export function PhotosSection({ taskId, photosBefore, photosAfter }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-e2 p-5 space-y-4">
      <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide">Фото</h2>
      <Gallery taskId={taskId} kind="before" label="До" photos={photosBefore} />
      <Gallery taskId={taskId} kind="after"  label="После" photos={photosAfter} />
    </div>
  )
}

function Gallery({ taskId, kind, label, photos }: {
  taskId: string; kind: 'before' | 'after'; label: string; photos: string[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true); setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)

    const res = await fetch(`/api/crm/tasks/${taskId}/photos`, { method: 'POST', body: form })
    setUploading(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Ошибка загрузки')
      return
    }
    router.refresh()
  }

  async function handleRemove(url: string) {
    await fetch(`/api/crm/tasks/${taskId}/photos`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ kind, url }),
    })
    router.refresh()
  }

  return (
    <div>
      <p className="text-label text-gray-500 mb-2">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((url) => (
          <div key={url} className="relative group aspect-square rounded-control overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => handleRemove(url)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-label opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
              title="Удалить"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-control border border-dashed border-gray-200 text-gray-500 hover:text-gray-500 hover:border-gray-300 transition flex items-center justify-center text-xl disabled:opacity-50"
        >
          {uploading ? '…' : '+'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="text-label text-danger mt-1">{error}</p>}
    </div>
  )
}
