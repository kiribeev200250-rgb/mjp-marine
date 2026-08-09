import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { QuotePublicActions } from './QuotePublicActions'

const LANGS = ['ru', 'en', 'es', 'uk', 'pl'] as const
type Lang = typeof LANGS[number]

const T: Record<Lang, Record<string, string>> = {
  ru: {
    quote: 'Пресмет', billTo: 'Получатель', date: 'Дата', validUntil: 'Действителен до',
    description: 'Описание', hours: 'Часы', rate: 'Норма/ч', qty: 'Кол-во', price: 'Цена за ед.', total: 'Сумма', subtotal: 'База',
    jobsTotal: 'Итого работа', materialsTotal: 'Итого материалы',
    iva: 'IVA', grandTotal: 'Итого', accept: 'Принять пресмет', reject: 'Отклонить',
    accepted: 'Пресмет принят! Мы свяжемся с вами для планирования работ.',
    rejected: 'Пресмет отклонён.', confirmReject: 'Отклонить этот пресмет?',
    alreadyAccepted: 'Этот пресмет уже принят.', alreadyRejected: 'Этот пресмет отклонён.',
    notFound: 'Пресмет не найден.',
  },
  en: {
    quote: 'Quote', billTo: 'Bill to', date: 'Date', validUntil: 'Valid until',
    description: 'Description', hours: 'Hours', rate: 'Rate/h', qty: 'Qty', price: 'Unit price', total: 'Total', subtotal: 'Subtotal',
    jobsTotal: 'Labor total', materialsTotal: 'Materials total',
    iva: 'VAT', grandTotal: 'Total', accept: 'Accept quote', reject: 'Reject',
    accepted: 'Quote accepted! We will contact you to schedule the work.',
    rejected: 'Quote rejected.', confirmReject: 'Reject this quote?',
    alreadyAccepted: 'This quote has already been accepted.', alreadyRejected: 'This quote has been rejected.',
    notFound: 'Quote not found.',
  },
  es: {
    quote: 'Presupuesto', billTo: 'Cliente', date: 'Fecha', validUntil: 'Válido hasta',
    description: 'Descripción', hours: 'Horas', rate: 'Tarifa/h', qty: 'Cant.', price: 'Precio/ud.', total: 'Importe', subtotal: 'Base',
    jobsTotal: 'Total mano de obra', materialsTotal: 'Total materiales',
    iva: 'IVA', grandTotal: 'Total', accept: 'Aceptar presupuesto', reject: 'Rechazar',
    accepted: '¡Presupuesto aceptado! Nos pondremos en contacto para planificar el trabajo.',
    rejected: 'Presupuesto rechazado.', confirmReject: '¿Rechazar este presupuesto?',
    alreadyAccepted: 'Este presupuesto ya ha sido aceptado.', alreadyRejected: 'Este presupuesto ha sido rechazado.',
    notFound: 'Presupuesto no encontrado.',
  },
  uk: {
    quote: 'Кошторис', billTo: 'Отримувач', date: 'Дата', validUntil: 'Дійсний до',
    description: 'Опис', hours: 'Години', rate: 'Ставка/год', qty: 'К-сть', price: 'Ціна/од.', total: 'Сума', subtotal: 'База',
    jobsTotal: 'Разом роботи', materialsTotal: 'Разом матеріали',
    iva: 'ПДВ', grandTotal: 'Разом', accept: 'Прийняти кошторис', reject: 'Відхилити',
    accepted: 'Кошторис прийнято! Ми зв’яжемося з вами для планування робіт.',
    rejected: 'Кошторис відхилено.', confirmReject: 'Відхилити цей кошторис?',
    alreadyAccepted: 'Цей кошторис вже прийнято.', alreadyRejected: 'Цей кошторис відхилено.',
    notFound: 'Кошторис не знайдено.',
  },
  pl: {
    quote: 'Wycena', billTo: 'Nabywca', date: 'Data', validUntil: 'Ważne do',
    description: 'Opis', hours: 'Godziny', rate: 'Stawka/h', qty: 'Ilość', price: 'Cena/szt.', total: 'Suma', subtotal: 'Podstawa',
    jobsTotal: 'Suma robocizny', materialsTotal: 'Suma materiałów',
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
      jobs:    { orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } },
      client:  { select: { firstName: true, lastName: true } },
      company: { include: { companyInfo: true } },
    },
  })
  if (!quote) notFound()

  const lang = resolveLang(quote.language)
  const t = T[lang]
  const companyName = quote.company.companyInfo?.legalName ?? quote.company.name
  const logoUrl = quote.company.companyInfo?.logoUrl

  return (
    <main style={{ minHeight: '100vh', background: '#f5f6f8', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ background: '#0A2342', borderRadius: 10, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />
          )}
          <div>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{companyName}</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '4px 0 0' }}>
              {t.quote} #{quote.number}
            </p>
          </div>
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

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1px solid #D6DCE5', borderRadius: 6, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#EEF1F5', borderBottom: '2px solid #0A2342' }}>
                <th style={{ textAlign: 'left', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', width: 32, borderRight: '1px solid #D6DCE5' }}>№</th>
                <th style={{ textAlign: 'left', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', borderRight: '1px solid #D6DCE5' }}>{t.description}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', borderRight: '1px solid #D6DCE5' }}>{t.hours}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', borderRight: '1px solid #D6DCE5' }}>{t.rate}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', borderRight: '1px solid #D6DCE5' }}>{t.qty}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px', borderRight: '1px solid #D6DCE5' }}>{t.price}</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#0A2342', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 6px' }}>{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {quote.jobs.map((job, ji) => (
                <Fragment key={job.id}>
                  <tr style={{ borderBottom: '1px solid #D6DCE5', background: '#fff' }}>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#0A2342', fontWeight: 700, borderRight: '1px solid #D6DCE5', borderLeft: '3px solid #C9A84C' }}>{ji + 1}</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#0A2342', fontWeight: 700, borderRight: '1px solid #D6DCE5' }}>{job.title}</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#0A2342', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>{job.laborHours?.toString() ?? '—'}</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#0A2342', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>{job.laborRate ? fmtMoney(job.laborRate) : '—'}</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#a0aec0', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>—</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#a0aec0', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>—</td>
                    <td style={{ padding: '8px 6px', fontSize: 14, color: '#0A2342', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(job.laborCost)}</td>
                  </tr>
                  {job.materials.map((m, mi) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #D6DCE5', background: '#FAFBFC' }}>
                      <td style={{ padding: '6px 6px', fontSize: 12, color: '#8892a6', borderRight: '1px solid #D6DCE5', borderLeft: '3px solid transparent' }}>{ji + 1}.{mi + 1}</td>
                      <td style={{ padding: '6px 6px 6px 20px', fontSize: 14, color: '#1a1a2e', borderRight: '1px solid #D6DCE5' }}>{m.name}</td>
                      <td style={{ padding: '6px 6px', fontSize: 14, color: '#a0aec0', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>—</td>
                      <td style={{ padding: '6px 6px', fontSize: 14, color: '#a0aec0', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>—</td>
                      <td style={{ padding: '6px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>{m.quantity.toString()}</td>
                      <td style={{ padding: '6px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right', borderRight: '1px solid #D6DCE5' }}>{fmtMoney(m.unitPrice)}</td>
                      <td style={{ padding: '6px 6px', fontSize: 14, color: '#1a1a2e', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(m.total)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div style={{ marginLeft: 'auto', width: 260, border: '1px solid #D6DCE5', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 10px', borderBottom: '1px solid #D6DCE5' }}>
              <span style={{ color: '#4a5568' }}>{t.jobsTotal}</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.jobsTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 10px', borderBottom: '1px solid #D6DCE5' }}>
              <span style={{ color: '#4a5568' }}>{t.materialsTotal}</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.materialsTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 10px', borderBottom: '1px solid #D6DCE5' }}>
              <span style={{ color: '#4a5568' }}>{t.subtotal}</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 10px', borderBottom: '1px solid #D6DCE5' }}>
              <span style={{ color: '#4a5568' }}>{t.iva} ({quote.ivaRate.toString()}%)</span>
              <span style={{ color: '#1a1a2e' }}>{fmtMoney(quote.ivaAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 700, padding: '12px 10px', background: '#0A2342', borderTop: '2px solid #C9A84C', color: '#C9A84C' }}>
              <span style={{ color: '#fff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.grandTotal}</span>
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