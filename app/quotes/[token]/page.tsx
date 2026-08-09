import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { QuotePublicActions } from './QuotePublicActions'

const LANGS = ['ru', 'en', 'es', 'uk', 'pl'] as const
type Lang = typeof LANGS[number]

const T: Record<Lang, Record<string, string>> = {
  ru: {
    quote: 'Пресмет', billTo: 'Получатель', date: 'Дата', validUntil: 'Действителен до',
    description: 'Описание', qty: 'Кол-во', price: 'Цена', total: 'Сумма', subtotal: 'База',
    iva: 'IVA', grandTotal: 'Итого', accept: 'Принять пресмет', reject: 'Отклонить',
    accepted: 'Пресмет принят! Мы свяжемся с вами для планирования работ.',
    rejected: 'Пресмет отклонён.', confirmReject: 'Отклонить этот пресмет?',
    alreadyAccepted: 'Этот пресмет уже принят.', alreadyRejected: 'Этот пресмет отклонён.',
    notFound: 'Пресмет не найден.',
  },
  en: {
    quote: 'Quote', billTo: 'Bill to', date: 'Date', validUntil: 'Valid until',
    description: 'Description', qty: 'Qty', price: 'Price', total: 'Total', subtotal: 'Subtotal',
    iva: 'VAT', grandTotal: 'Total', accept: 'Accept quote', reject: 'Reject',
    accepted: 'Quote accepted! We will contact you to schedule the work.',
    rejected: 'Quote rejected.', confirmReject: 'Reject this quote?',
    alreadyAccepted: 'This quote has already been accepted.', alreadyRejected: 'This quote has been rejected.',
    notFound: 'Quote not found.',
  },
  es: {
    quote: 'Presupuesto', billTo: 'Cliente', date: 'Fecha', validUntil: 'Válido hasta',
    description: 'Descripción', qty: 'Cant.', price: 'Precio', total: 'Importe', subtotal: 'Base',
    iva: 'IVA', grandTotal: 'Total', accept: 'Aceptar presupuesto', reject: 'Rechazar',
    accepted: '¡Presupuesto aceptado! Nos pondremos en contacto para planificar el trabajo.',
    rejected: 'Presupuesto rechazado.', confirmReject: '¿Rechazar este presupuesto?',
    alreadyAccepted: 'Este presupuesto ya ha sido aceptado.', alreadyRejected: 'Este presupuesto ha sido rechazado.',
    notFound: 'Presupuesto no encontrado.',
  },
  uk: {
    quote: 'Кошторис', billTo: 'Отримувач', date: 'Дата', validUntil: 'Дійсний до',
    description: 'Опис', qty: 'К-сть', price: 'Ціна', total: 'Сума', subtotal: 'База',
    iva: 'ПДВ', grandTotal: 'Разом', accept: 'Прийняти кошторис', reject: 'Відхилити',
    accepted: 'Кошторис прийнято! Ми зв’яжемося з вами для планування робіт.',
    rejected: 'Кошторис відхилено.', confirmReject: 'Відхилити цей кошторис?',
    alreadyAccepted: 'Цей кошторис вже прийнято.', alreadyRejected: 'Цей кошторис відхилено.',
    notFound: 'Кошторис не знайдено.',
  },
  pl: {
    quote: 'Wycena', billTo: 'Nabywca', date: 'Data', validUntil: 'Ważne do',
    description: 'Opis', qty: 'Ilość', price: 'Cena', total: 'Suma', subtotal: 'Podstawa',
    iva: 'VAT', grandTotal: 'Razem', accept: 'Zaakceptuj wycenę', reject: 'Odrzuć',
    accepted: 'Wycena zaakceptowana! Skontaktujemy się w sprawie planowania prac.',
    rejected: 'Wycena odrzucona.', confirmReject: 'Odrzucić tę wycenę?',
    alreadyAccepted: 'Ta wycena została już zaakceptowana.', alreadyRejected: 'Ta wycena została odrzucona.',
    notFound: 'Nie znaleziono wyceny.',
  },
}

function resolveLang(l: string): Lang {
  return (LANGS as readonly string[]).includes(l) ? (l as Lang) : 'ru'
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}
function fmtMoney(v: unknown) {
  return `${Number(v).toFixed(2)} €`
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const quote = await prisma.quote.findUnique({
    where:   { publicToken: token },
    include: {
      items:   { orderBy: { sortOrder: 'asc' } },
      client:  { select: { firstName: true, lastName: true } },
      company: { include: { companyInfo: true } },
    },
  })
  if (!quote) notFound()

  const lang = resolveLang(quote.language)
  const t = T[lang]
  const companyName = quote.company.companyInfo?.legalName ?? quote.company.name

  return (
    <main style={{ minHeight: '100vh', background: '#f5f6f8', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ background: '#0A2342', borderRadius: 10, padding: '24px 28px', marginBottom: 20 }}>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{companyName}</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '4px 0 0' }}>
            {t.quote} #{quote.number}
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: '#8892a6', textTransform: 'uppercase', margin: '0 0 4px' }}>{t.billTo}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                {quote.client.firstName} {quote.client.lastName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: '#8892a6', textTransform: 'uppercase', margin: '0 0 4px' }}>{t.date}</p>
              <p style={{ fontSize: 14, color: '#1a1a2e', margin: 0 }}>{fmtDate(quote.createdAt)}</p>
              {quote.validUntil && (
                <>
                  <p style={{ fontSize: 11, color: '#8892a6', textTransform: 'uppercase', margin: '10px 0 4px' }}>{t.validUntil}</p>
                  <p style={{ fontSize: 14, color: '#1a1a2e', margin: 0 }}>{fmtDate(quote.validUntil)}</p>
                </>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f5f6f8' }}>
                <th style={{ textAlign: 'left', fontSize: 10, color: '#8892a6', textTransform: 'uppercase', padding: '8px 6px' }}>{t.description}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#8892a6', textTransform: 'uppercase', padding: '8px 6px' }}>{t.qty}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#8892a6', textTransform: 'uppercase', padding: '8px 6px' }}>{t.price}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#8892a6', textTransform: 'uppercase', padding: '8px 6px' }}>{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eef0f3' }}>
                  <td style={{ padding: '8px 6px', fontSize: 14, color: '#1a1a2e' }}>{item.description}</td>
                  <td style={{ padding: '8px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right' }}>{item.quantity.toString()}</td>
                  <td style={{ padding: '8px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right' }}>{fmtMoney(item.unitPrice)}</td>
                  <td style={{ padding: '8px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginLeft: 'auto', width: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0' }}>
              <span style={{ color: '#4a5568' }}>{t.subtotal}</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0' }}>
              <span style={{ color: '#4a5568' }}>{t.iva} ({quote.ivaRate.toString()}%)</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.ivaAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, padding: '10px 0 0', marginTop: 6, borderTop: '2px solid #0A2342', color: '#0A2342' }}>
              <span>{t.grandTotal}</span>
              <span>{fmtMoney(quote.total)}</span>
            </div>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #eef0f3' }}>
            {quote.status === 'ACCEPTED' && (
              <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#2e7d32' }}>✓ {t.alreadyAccepted}</p>
            )}
            {quote.status === 'REJECTED' && (
              <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#c0392b' }}>{t.alreadyRejected}</p>
            )}
            {(quote.status === 'SENT' || quote.status === 'DRAFT') && (
              <QuotePublicActions
                token={token}
                labels={{ accept: t.accept, reject: t.reject, accepted: t.accepted, rejected: t.rejected, confirmReject: t.confirmReject }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}