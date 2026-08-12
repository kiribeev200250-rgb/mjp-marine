import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmSession } from '@/lib/crm/session'
import { requirePermission } from '@/lib/crm/permissions'
import { prisma } from '@/lib/prisma'
import { formatMoney, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS } from '@/lib/crm/utils'
import { Badge, Button, DataTable, ExportCsvButton, INVOICE_TONE, QUOTE_TONE, type Column } from '@/components/crm/ui'
import { outstandingBalances } from '@/lib/crm/services/ar'
import type { Invoice, Quote, Client } from '@prisma/client'

interface SearchParams { tab?: string }

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVOICES', 'VIEW')

  const tab = sp.tab === 'quotes' ? 'quotes' : 'invoices'

  const [invoices, quotes] = await Promise.all([
    prisma.invoice.findMany({
      where:   { companyId: session.user.companyId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    }),
    prisma.quote.findMany({
      where:   { companyId: session.user.companyId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const outstandingInvoices = invoices
    .filter((i) => i.status === 'ISSUED' || i.status === 'PARTIAL' || i.status === 'OVERDUE')
  // Для PARTIAL (частично возвращённая ранее оплата) остаток к получению —
  // total за вычетом уже зачтённого дохода, не весь total (см. lib/crm/services/ar.ts)
  const balances = await outstandingBalances(outstandingInvoices)
  const totalOutstanding = outstandingInvoices
    .reduce((s, i) => s + balances.get(i.id)!.toNumber(), 0)

  type InvoiceRow = Invoice & { client: Pick<Client, 'id' | 'firstName' | 'lastName'> }
  type QuoteRow   = Quote   & { client: Pick<Client, 'id' | 'firstName' | 'lastName'> }

  const invoiceColumns: Column<InvoiceRow>[] = [
    { key: 'number', header: 'Номер', render: (r) => (
      <Link href={`/crm/invoices/${r.id}`} className="font-mono text-gray-900 hover:text-gold transition">{r.number}</Link>
    ) },
    { key: 'client', header: 'Клиент', render: (r) => (
      <Link href={`/crm/clients/${r.client.id}`} className="text-gray-900 hover:text-gold transition">
        {r.client.firstName} {r.client.lastName}
      </Link>
    ) },
    { key: 'date', header: 'Дата', render: (r) => fmtDate(r.date) },
    { key: 'total', header: 'Сумма', align: 'right', render: (r) => (
      <span className="tabular-nums font-medium">{formatMoney(r.total)}</span>
    ) },
    { key: 'status', header: 'Статус', render: (r) => (
      <Badge tone={INVOICE_TONE[r.status] ?? 'neutral'}>{INVOICE_STATUS_LABELS[r.status] ?? r.status}</Badge>
    ) },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      r.status === 'DRAFT' ? (
        <Link href={`/crm/invoices/${r.id}/edit`} className="text-gray-500 hover:text-gold transition text-label">✏ Редактировать</Link>
      ) : null
    ) },
  ]

  const quoteColumns: Column<QuoteRow>[] = [
    { key: 'number', header: 'Номер', render: (r) => (
      <Link href={`/crm/invoices/quote/${r.id}`} className="font-mono text-gray-900 hover:text-gold transition">{r.number}</Link>
    ) },
    { key: 'client', header: 'Клиент', render: (r) => (
      <Link href={`/crm/clients/${r.client.id}`} className="text-gray-900 hover:text-gold transition">
        {r.client.firstName} {r.client.lastName}
      </Link>
    ) },
    { key: 'date', header: 'Дата', render: (r) => fmtDate(r.createdAt) },
    { key: 'total', header: 'Сумма', align: 'right', render: (r) => (
      <span className="tabular-nums font-medium">{formatMoney(r.total)}</span>
    ) },
    { key: 'status', header: 'Статус', render: (r) => (
      <Badge tone={QUOTE_TONE[r.status] ?? 'neutral'}>{QUOTE_STATUS_LABELS[r.status] ?? r.status}</Badge>
    ) },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <Link href={`/crm/invoices/quote/${r.id}/edit`} className="text-gray-500 hover:text-gold transition text-label">✏ Редактировать</Link>
    ) },
  ]

  const rowsInvoices: InvoiceRow[] = invoices as InvoiceRow[]
  const rowsQuotes: QuoteRow[]     = quotes as QuoteRow[]

  // Плоские сериализуемые версии для CSV — Decimal/Date не пересекают серверную границу
  const csvInvoices = invoices.map((r) => ({
    number: r.number, client: `${r.client.firstName} ${r.client.lastName}`,
    date: fmtDate(r.date), total: Number(r.total), status: INVOICE_STATUS_LABELS[r.status] ?? r.status,
  }))
  const csvQuotes = quotes.map((r) => ({
    number: r.number, client: `${r.client.firstName} ${r.client.lastName}`,
    date: fmtDate(r.createdAt), total: Number(r.total), status: QUOTE_STATUS_LABELS[r.status] ?? r.status,
  }))

  return (
    <main className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-heading font-bold text-gray-900">Счета и пресметы</h1>
          <p className="text-label text-gray-500 mt-0.5">
            Неоплачено: <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(totalOutstanding)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'invoices' ? (
            <ExportCsvButton
              filename="invoices"
              headers={['Номер', 'Клиент', 'Дата', 'Сумма', 'Статус']}
              rows={csvInvoices.map((r) => [r.number, r.client, r.date, r.total, r.status])}
            />
          ) : (
            <ExportCsvButton
              filename="quotes"
              headers={['Номер', 'Клиент', 'Дата', 'Сумма', 'Статус']}
              rows={csvQuotes.map((r) => [r.number, r.client, r.date, r.total, r.status])}
            />
          )}
          <Link href="/crm/invoices/quote/new"><Button variant="secondary">📄 Новый пресмет</Button></Link>
          <Link href="/crm/invoices/new"><Button>🧾 Новый счёт</Button></Link>
        </div>
      </div>

      <div className="px-6 pt-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex gap-1">
          <Link
            href="/crm/invoices?tab=invoices"
            className={`px-4 py-2 text-body font-semibold rounded-t-control transition ${
              tab === 'invoices' ? 'bg-gray-50 text-gray-900 border-t border-x border-gray-200' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Счета ({invoices.length})
          </Link>
          <Link
            href="/crm/invoices?tab=quotes"
            className={`px-4 py-2 text-body font-semibold rounded-t-control transition ${
              tab === 'quotes' ? 'bg-gray-50 text-gray-900 border-t border-x border-gray-200' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Пресметы ({quotes.length})
          </Link>
        </div>
      </div>

      <div className="flex-1 p-6">
        {tab === 'invoices' ? (
          <DataTable
            columns={invoiceColumns}
            rows={rowsInvoices}
            keyField="id"
            emptyIcon="🧾"
            emptyText="Счетов пока нет"
          />
        ) : (
          <DataTable
            columns={quoteColumns}
            rows={rowsQuotes}
            keyField="id"
            emptyIcon="📄"
            emptyText="Пресметов пока нет"
          />
        )}
      </div>
    </main>
  )
}