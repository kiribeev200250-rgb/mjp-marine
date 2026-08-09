import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { ClientForm } from '@/components/crm/clients/ClientForm'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'CLIENTS', 'EDIT')

  const client = await prisma.client.findFirst({
    where: { id, companyId: session.user.companyId },
  })
  if (!client) notFound()

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <Link href={`/crm/clients/${client.id}`} className="text-gray-200 hover:text-gray-500 text-body transition">← {client.firstName} {client.lastName}</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-heading font-bold text-gray-900">Редактировать клиента</h1>
      </div>
      <div className="flex-1 p-6">
        <ClientForm
          clientId={client.id}
          initialData={{
            firstName: client.firstName,
            lastName:  client.lastName,
            phone:     client.phone,
            email:     client.email,
            marina:    client.marina,
            source:    client.source,
            language:  client.language,
            notes:     client.notes,
          }}
        />
      </div>
    </main>
  )
}
