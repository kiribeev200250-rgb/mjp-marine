import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { CrmSidebar } from '@/components/crm/layout/CrmSidebar'
import { CrmTopbar } from '@/components/crm/layout/CrmTopbar'
import { prisma } from '@/lib/prisma'

export default async function CrmAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')

  const company = await prisma.company.findFirst({
    where:  { id: session.user.companyId },
    select: { name: true },
  })

  const userName    = session.user.name
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <CrmSidebar
        companyName={company?.name ?? 'MJP Marine'}
        userName={userName}
        roleLabel={session.user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <CrmTopbar userName={userName} userInitial={userInitial} />
        {children}
      </div>
    </div>
  )
}