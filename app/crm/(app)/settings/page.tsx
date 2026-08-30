import { getCrmSession } from '@/lib/crm/session'
import { CompanyInfoForm } from './CompanyInfoForm'
import { UsersSection } from './UsersSection'
import { FbLeadAdsForm } from './FbLeadAdsForm'
import { PeriodLocksSection } from './PeriodLocksSection'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')

  if (session.user.role !== 'ADMIN') {
    return (
      <main className="flex-1 p-6 flex items-center justify-center">
        <p className="text-gray-500 text-body">Нет доступа к настройкам.</p>
      </main>
    )
  }

  const companyId = session.user.companyId

  const [companyInfo, users, periodLocks] = await Promise.all([
    prisma.companyInfo.findUnique({ where: { companyId } }),
    prisma.crmUser.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'asc' },
      select:  { id: true, name: true, email: true, role: true, active: true, createdAt: true, telegramId: true, scope: true, marina: true },
    }),
    prisma.periodLock.findMany({
      where:   { companyId },
      orderBy: { startDate: 'desc' },
      include: { closedBy: { select: { name: true } } },
    }),
  ])

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-heading font-bold text-gray-900">Настройки</h1>
        <p className="text-label text-gray-500 mt-0.5">Компания, реквизиты, пользователи</p>
      </div>

      <div className="flex-1 p-6 space-y-8">
        <section className="max-w-3xl">
          <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">
            Реквизиты компании (для счетов)
          </h2>
          <CompanyInfoForm companyId={companyId} data={companyInfo} />
        </section>

        {/* Без max-w-3xl — таблице с 6 колонками (включая код привязки Telegram)
            нужна вся ширина контента, иначе она обрезается справа без возможности
            прокрутки внутри узкой колонки. */}
        <section>
          <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">
            Пользователи CRM
          </h2>
          <UsersSection companyId={companyId} users={users} />
        </section>

        <section className="max-w-3xl">
          <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">
            Facebook Lead Ads
          </h2>
          <FbLeadAdsForm data={companyInfo} />
        </section>

        <section>
          <h2 className="text-label text-gray-500 font-semibold uppercase tracking-wide mb-4">
            Закрытие периодов
          </h2>
          <p className="text-label text-gray-500 -mt-3 mb-4 max-w-3xl">
            Внутри закрытого периода финансовые операции нельзя редактировать или удалять —
            только сторнировать записью в открытом периоде.
          </p>
          <PeriodLocksSection
            locks={periodLocks.map((l) => ({
              id:        l.id,
              label:     l.label,
              startDate: l.startDate.toISOString(),
              endDate:   l.endDate.toISOString(),
              closedAt:  l.closedAt.toISOString(),
              closedBy:  l.closedBy,
            }))}
          />
        </section>
      </div>
    </main>
  )
}