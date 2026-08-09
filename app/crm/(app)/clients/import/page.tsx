import { CsvImport } from '@/components/crm/clients/CsvImport'

export default function ImportPage() {
  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-heading font-bold text-gray-900">Импорт клиентов из CSV</h1>
      </div>
      <div className="flex-1 p-6">
        <CsvImport />
      </div>
    </main>
  )
}