'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'

interface ParsedRow { [key: string]: string }

// Шаблон CSV для скачивания
const CSV_TEMPLATE = `firstName,lastName,phone,email,marina,source,language,notes
Иван,Петров,+34600000001,ivan@example.com,Alicante,MANUAL,ru,
Maria,Garcia,+34600000002,maria@example.com,Dénia,REFERRAL,es,Клиент по рекомендации`

export function CsvImport() {
  const router    = useRouter()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [rows,      setRows]      = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null)
  const [parseErr,  setParseErr]  = useState('')

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'mjp_clients_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseErr('')
    setResult(null)

    Papa.parse<ParsedRow>(file, {
      header:       true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors.length) {
          setParseErr(`Ошибка разбора CSV: ${errors[0].message}`)
          return
        }
        if (data.length === 0) { setParseErr('Файл пуст'); return }
        if (data.length > 500) { setParseErr('Максимум 500 строк за раз'); return }
        setRows(data)
      },
      error: (err) => setParseErr(err.message),
    })
  }

  async function handleImport() {
    if (!rows.length) return
    setImporting(true)
    setResult(null)

    const res = await fetch('/api/crm/clients/import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rows }),
    })

    setImporting(false)
    const data = await res.json()
    setResult(data)

    if (data.imported > 0) {
      setRows([])
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Скачать шаблон */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-medium text-sm mb-2">1. Скачай шаблон CSV</h3>
        <p className="text-white/40 text-xs mb-3">
          Колонки: firstName, lastName, phone, email, marina, source, language, notes
        </p>
        <button
          onClick={downloadTemplate}
          className="bg-white/10 hover:bg-white/15 text-white text-sm px-4 py-2 rounded-lg transition"
        >
          ⬇ Скачать шаблон
        </button>
      </div>

      {/* Загрузить файл */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-medium text-sm mb-3">2. Загрузи заполненный файл</h3>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block text-white/60 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#C9A84C]/20 file:text-[#C9A84C] hover:file:bg-[#C9A84C]/30 cursor-pointer"
        />
        {parseErr && <p className="text-[#C0392B] text-xs mt-2">{parseErr}</p>}
      </div>

      {/* Предпросмотр */}
      {rows.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-3">
            3. Предпросмотр — {rows.length} {rows.length === 1 ? 'строка' : 'строк'}
          </h3>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {Object.keys(rows[0]).map((k) => (
                    <th key={k} className="text-white/40 text-left px-3 py-1.5 font-medium">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="text-white/60 px-3 py-1.5 max-w-[120px] truncate">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-white/30 text-xs mt-2">... и ещё {rows.length - 5} строк</p>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-4 bg-[#C9A84C] hover:bg-[#E8C96A] disabled:opacity-50 text-[#0A2342] font-bold px-6 py-2.5 rounded-lg transition text-sm"
          >
            {importing ? 'Импортируем...' : `Импортировать ${rows.length} клиентов`}
          </button>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className={`rounded-xl p-4 ${result.imported > 0 ? 'bg-[#27AE60]/15 border border-[#27AE60]/30' : 'bg-[#C0392B]/15 border border-[#C0392B]/30'}`}>
          <p className={`font-medium text-sm ${result.imported > 0 ? 'text-[#27AE60]' : 'text-[#C0392B]'}`}>
            Импортировано: {result.imported}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.errors.map((e) => (
                <p key={e.row} className="text-white/50 text-xs">Строка {e.row}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}