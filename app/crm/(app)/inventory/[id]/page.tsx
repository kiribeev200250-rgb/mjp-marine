import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm/session'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/crm/permissions'
import { ItemForm } from '@/components/crm/inventory/ItemForm'
import { Badge } from '@/components/crm/ui'
import Decimal from 'decimal.js'

const TYPE_RU: Record<string, string> = {
  RECEIVE:  'Приход',
  WRITE_OFF:'Списание',
  SELL:     'Продажа',
  ADJUST:   'Корректировка',
  ORDER:    'Заказано',
}

const TYPE_COLOR: Record<string, string> = {
  RECEIVE:  'success',
  SELL:     'success',
  WRITE_OFF:'danger',
  ADJUST:   'info',
  ORDER:    'warning',
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

function fmtMoney(v: { toString(): string }) {
  const n = new Decimal(v.toString())
  return n.isZero() ? '—' : `${n.toFixed(2)} €`
}

function fmtQty(v: { toString(): string }, unit: string) {
  const n = new Decimal(v.toString())
  return `${n.isInteger() ? n.toFixed(0) : n.toFixed(2)} ${unit}`
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getCrmSession()
  if (!session) redirect('/crm/login')
  requirePermission(session.user.role, session.user.permissions, 'INVENTORY', 'VIEW')

  const item = await prisma.inventoryItem.findFirst({
    where:   { id, companyId: session.user.companyId },
    include: {
      movements: {
        orderBy: { createdAt: 'desc' },
        take:    50,
        include: { task: { select: { id: true, title: true } } },
      },
    },
  })
  if (!item) notFound()

  const rawCategories = await prisma.inventoryItem.findMany({
    where:    { companyId: session.user.companyId, active: true },
    select:   { category: true },
    distinct: ['category'],
    orderBy:  { category: 'asc' },
  })
  const categories = rawCategories.map((r) => r.category).filter(Boolean) as string[]

  const qty      = new Decimal(item.qtyInStock.toString())
  const minAlert = new Decimal(item.qtyMinAlert.toString())
  const isLow    = minAlert.gt(0) && qty.lt(minAlert)
  const isOut    = qty.lte(0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-label text-gray-500 mb-1">
          <Link href="/crm/inventory" className="hover:text-gray-900 transition">Склад</Link>
          <span>/</span>
          <span className="text-gray-900 truncate max-w-xs">{item.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-heading font-bold text-gray-900">{item.name}</h1>
          <div className="flex items-center gap-3">
            {isOut    && <Badge tone="danger">Нет в наличии</Badge>}
            {isLow && !isOut && <Badge tone="warning">Мало на складе</Badge>}
            {!isLow && !isOut && <Badge tone="success">В наличии</Badge>}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto grid grid-cols-3 gap-6 items-start">
        {/* Left: edit form */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-6">
            <h2 className="text-subheading font-bold text-gray-900 mb-4">Параметры товара</h2>
            <ItemForm
              categories={categories}
              item={{
                id:          item.id,
                name:        item.name,
                category:    item.category,
                unit:        item.unit,
                qtyMinAlert: item.qtyMinAlert.toString(),
                costPrice:   item.costPrice.toString(),
                sellPrice:   item.sellPrice.toString(),
                supplier:    item.supplier,
                notes:       item.notes,
              }}
            />
          </div>
        </div>

        {/* Right: KPIs + movements */}
        <div className="space-y-4">
          {/* Stock KPIs */}
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-4 space-y-3">
            <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">Остатки</h3>
            <div className="space-y-2">
              {[
                { label: 'В наличии',  value: fmtQty(item.qtyInStock,  item.unit), color: isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-gray-900' },
                { label: 'В заказе',   value: fmtQty(item.qtyOrdered,  item.unit), color: 'text-gray-900' },
                { label: 'Мин. порог', value: fmtQty(item.qtyMinAlert, item.unit), color: 'text-gray-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-label text-gray-500">{label}</span>
                  <span className={`text-body font-medium tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price KPIs */}
          <div className="bg-white rounded-card shadow-e2 border border-gray-200/60 p-4 space-y-3">
            <h3 className="text-label text-gray-500 uppercase tracking-wide font-semibold">Цены</h3>
            <div className="space-y-2">
              {[
                { label: 'Закупочная', value: fmtMoney(item.costPrice) },
                { label: 'Продажная',  value: fmtMoney(item.sellPrice) },
                { label: 'Поставщик',  value: item.supplier || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-label text-gray-500 shrink-0">{label}</span>
                  <span className="text-body text-gray-900 tabular-nums text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movement history — full width */}
        <div className="col-span-3 bg-white rounded-card shadow-e2 border border-gray-200/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-subheading font-bold text-gray-900">История движений</h2>
            <span className="text-label text-gray-500">{item.movements.length} записей</span>
          </div>
          {item.movements.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-body">Движений ещё нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Дата', 'Тип', 'Кол-во', 'Цена/ед.', 'Сумма', 'Задача', 'Заметка'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-label text-gray-500 uppercase tracking-wide font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.movements.map((mv) => {
                    const qtyD  = new Decimal(mv.qty.toString())
                    const sign  = ['WRITE_OFF', 'SELL'].includes(mv.type) ? '−' : ['RECEIVE', 'ADJUST', 'ORDER'].includes(mv.type) ? '+' : ''
                    return (
                      <tr key={mv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-label text-gray-500 whitespace-nowrap">{fmtDate(mv.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={TYPE_COLOR[mv.type] as 'success' | 'danger' | 'info' | 'warning' | 'neutral'}>
                            {TYPE_RU[mv.type] ?? mv.type}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-body tabular-nums font-medium ${['WRITE_OFF','SELL'].includes(mv.type) ? 'text-danger' : 'text-success'}`}>
                          {sign}{qtyD.isInteger() ? qtyD.toFixed(0) : qtyD.toFixed(2)} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-body text-gray-500 tabular-nums">{fmtMoney(mv.unitPrice)}</td>
                        <td className="px-4 py-3 text-body text-gray-900 tabular-nums">{fmtMoney(mv.total)}</td>
                        <td className="px-4 py-3">
                          {mv.task ? (
                            <Link href={`/crm/schedule/${mv.task.id}`} className="text-label text-info hover:underline truncate max-w-[140px] block">
                              {mv.task.title}
                            </Link>
                          ) : <span className="text-gray-200 text-label">—</span>}
                        </td>
                        <td className="px-4 py-3 text-body text-gray-500 max-w-[180px] truncate">{mv.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}