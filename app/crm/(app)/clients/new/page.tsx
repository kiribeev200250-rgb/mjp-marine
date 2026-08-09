import { ClientForm } from '@/components/crm/clients/ClientForm'

export default function NewClientPage() {
  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-heading font-bold text-gray-900">Новый клиент</h1>
      </div>
      <div className="flex-1 p-6">
        <ClientForm />
      </div>
    </main>
  )
}