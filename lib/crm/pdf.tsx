import path from 'node:path'
import { Document, Page, Text, View, StyleSheet, Font, renderToStream } from '@react-pdf/renderer'

// Шрифт зашит в репозиторий (public/fonts) — без сетевого запроса к Google при каждом рендере PDF.
// Полное покрытие: кириллица (ru/uk) + латиница с диакритикой (es/pl).
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(FONTS_DIR, 'Roboto-Regular.ttf') },
    { src: path.join(FONTS_DIR, 'Roboto-Bold.ttf'), fontWeight: 700 },
  ],
})

const NAVY = '#0A2342'
const GOLD = '#C9A84C'

const styles = StyleSheet.create({
  page:      { fontFamily: 'Roboto', fontSize: 9.5, padding: 36, color: '#1a1a2e' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, backgroundColor: NAVY, padding: 18, borderRadius: 6 },
  companyName: { color: '#fff', fontSize: 15, fontWeight: 700 },
  companySub:  { color: 'rgba(255,255,255,0.65)', fontSize: 8.5, marginTop: 2 },
  docBadge:    { color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  docNumber:   { color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 2 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  metaBlock: { maxWidth: '48%' },
  metaLabel: { fontSize: 7.5, color: '#8892a6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { fontSize: 10, color: '#1a1a2e', fontWeight: 700 },
  metaLine:  { fontSize: 9, color: '#4a5568', marginTop: 1 },
  table:     { borderTopWidth: 1, borderTopColor: '#e2e5eb', marginBottom: 14 },
  tHeadRow:  { flexDirection: 'row', backgroundColor: '#f5f6f8', paddingVertical: 6, paddingHorizontal: 4 },
  tRow:      { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eef0f3' },
  tHeadCell: { fontSize: 7.5, color: '#8892a6', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 },
  tCell:     { fontSize: 9.5, color: '#1a1a2e' },
  colDesc:   { flex: 1 },
  colQty:    { width: 50, textAlign: 'right' },
  colPrice:  { width: 70, textAlign: 'right' },
  colTotal:  { width: 75, textAlign: 'right' },
  totals:    { alignSelf: 'flex-end', width: 220, marginBottom: 20 },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel:{ fontSize: 9.5, color: '#4a5568' },
  totalValue:{ fontSize: 9.5, color: '#1a1a2e', fontWeight: 700 },
  grandRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1.5, borderTopColor: NAVY },
  grandLabel:{ fontSize: 12, color: NAVY, fontWeight: 700 },
  grandValue:{ fontSize: 14, color: NAVY, fontWeight: 700 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerBlock: { maxWidth: '48%' },
  footerLabel: { fontSize: 7.5, color: '#8892a6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  footerValue: { fontSize: 9, color: '#4a5568' },
  disclaimer: { marginTop: 22, padding: 10, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f0d9b5', borderRadius: 4 },
  disclaimerText: { fontSize: 8, color: '#8a6116' },
  notes: { marginTop: 14, fontSize: 8.5, color: '#4a5568' },
})

const LANGS = ['ru', 'en', 'es', 'uk', 'pl'] as const
export type PdfLang = typeof LANGS[number]

const T: Record<PdfLang, Record<string, string>> = {
  ru: {
    invoice: 'СЧЁТ', quote: 'ПРЕСМЕТ', billTo: 'Получатель', date: 'Дата',
    dueDate: 'Срок оплаты', validUntil: 'Действителен до', description: 'Описание',
    qty: 'Кол-во', unitPrice: 'Цена', total: 'Сумма', subtotal: 'База',
    iva: 'IVA', irpf: 'IRPF', grandTotal: 'Итого', paymentMethod: 'Способ оплаты',
    bankAccount: 'Банковский счёт', notes: 'Примечания',
    disclaimer: 'Перед использованием сверьтесь с gestor’ом (бухгалтером) — документ носит информационный характер.',
  },
  en: {
    invoice: 'INVOICE', quote: 'QUOTE', billTo: 'Bill to', date: 'Date',
    dueDate: 'Due date', validUntil: 'Valid until', description: 'Description',
    qty: 'Qty', unitPrice: 'Unit price', total: 'Total', subtotal: 'Subtotal',
    iva: 'VAT', irpf: 'IRPF', grandTotal: 'Total', paymentMethod: 'Payment method',
    bankAccount: 'Bank account', notes: 'Notes',
    disclaimer: 'Please verify with your gestor (accountant) before use — this document is informational.',
  },
  es: {
    invoice: 'FACTURA', quote: 'PRESUPUESTO', billTo: 'Cliente', date: 'Fecha',
    dueDate: 'Vencimiento', validUntil: 'Válido hasta', description: 'Descripción',
    qty: 'Cant.', unitPrice: 'Precio', total: 'Importe', subtotal: 'Base imponible',
    iva: 'IVA', irpf: 'IRPF', grandTotal: 'Total', paymentMethod: 'Forma de pago',
    bankAccount: 'Cuenta bancaria', notes: 'Notas',
    disclaimer: 'Verifique con su gestor antes de usar este documento — tiene carácter informativo.',
  },
  uk: {
    invoice: 'РАХУНОК', quote: 'КОШТОРИС', billTo: 'Отримувач', date: 'Дата',
    dueDate: 'Термін оплати', validUntil: 'Дійсний до', description: 'Опис',
    qty: 'К-сть', unitPrice: 'Ціна', total: 'Сума', subtotal: 'База',
    iva: 'ПДВ', irpf: 'IRPF', grandTotal: 'Разом', paymentMethod: 'Спосіб оплати',
    bankAccount: 'Банківський рахунок', notes: 'Примітки',
    disclaimer: 'Перед використанням звірте з gestor’ом (бухгалтером) — документ має інформаційний характер.',
  },
  pl: {
    invoice: 'FAKTURA', quote: 'WYCENA', billTo: 'Nabywca', date: 'Data',
    dueDate: 'Termin płatności', validUntil: 'Ważne do', description: 'Opis',
    qty: 'Ilość', unitPrice: 'Cena', total: 'Suma', subtotal: 'Podstawa',
    iva: 'VAT', irpf: 'IRPF', grandTotal: 'Razem', paymentMethod: 'Sposób płatności',
    bankAccount: 'Konto bankowe', notes: 'Uwagi',
    disclaimer: 'Przed użyciem skonsultuj się z gestorem (księgowym) — dokument ma charakter informacyjny.',
  },
}

function resolveLang(language: string): PdfLang {
  return (LANGS as readonly string[]).includes(language) ? (language as PdfLang) : 'ru'
}

function fmtMoney(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return `${n.toFixed(2)} €`
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export interface PdfLineItem {
  description: string
  quantity:    string
  unitPrice:   string
  total:       string
}

export interface PdfCompanyInfo {
  legalName:   string
  nif:         string
  address:     string
  city:        string
  postalCode:  string
  country:     string
  email:       string
  phone:       string
  bankAccount: string
}

export interface PdfDocumentData {
  kind:          'invoice' | 'quote'
  number:        string
  date:          Date | string
  dueDate?:      Date | string | null
  validUntil?:   Date | string | null
  language:      string
  company:       PdfCompanyInfo
  clientName:    string
  clientNif?:    string
  clientAddress?:string
  items:         PdfLineItem[]
  subtotal:      string
  ivaRate:       string
  ivaAmount:     string
  irpfRate?:     string
  irpfAmount?:   string
  total:         string
  paymentMethod?:string
  notes?:        string
}

function DocumentPdf({ data }: { data: PdfDocumentData }) {
  const lang = resolveLang(data.language)
  const t = T[lang]
  const hasIrpf = data.irpfAmount != null && parseFloat(data.irpfAmount) !== 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{data.company.legalName}</Text>
            <Text style={styles.companySub}>
              {data.company.address}, {data.company.city}
              {data.company.postalCode ? ` ${data.company.postalCode}` : ''}, {data.company.country}
            </Text>
            <Text style={styles.companySub}>NIF: {data.company.nif}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.docBadge}>{data.kind === 'invoice' ? t.invoice : t.quote}</Text>
            <Text style={styles.docNumber}>#{data.number}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t.billTo}</Text>
            <Text style={styles.metaValue}>{data.clientName}</Text>
            {data.clientNif ? <Text style={styles.metaLine}>NIF: {data.clientNif}</Text> : null}
            {data.clientAddress ? <Text style={styles.metaLine}>{data.clientAddress}</Text> : null}
          </View>
          <View style={[styles.metaBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.metaLabel}>{t.date}</Text>
            <Text style={styles.metaValue}>{fmtDate(data.date)}</Text>
            {data.kind === 'invoice' && data.dueDate ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 6 }]}>{t.dueDate}</Text>
                <Text style={styles.metaLine}>{fmtDate(data.dueDate)}</Text>
              </>
            ) : null}
            {data.kind === 'quote' && data.validUntil ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 6 }]}>{t.validUntil}</Text>
                <Text style={styles.metaLine}>{fmtDate(data.validUntil)}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, styles.colDesc]}>{t.description}</Text>
            <Text style={[styles.tHeadCell, styles.colQty]}>{t.qty}</Text>
            <Text style={[styles.tHeadCell, styles.colPrice]}>{t.unitPrice}</Text>
            <Text style={[styles.tHeadCell, styles.colTotal]}>{t.total}</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tRow}>
              <Text style={[styles.tCell, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tCell, styles.colPrice]}>{fmtMoney(item.unitPrice)}</Text>
              <Text style={[styles.tCell, styles.colTotal]}>{fmtMoney(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.subtotal}</Text>
            <Text style={styles.totalValue}>{fmtMoney(data.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.iva} ({data.ivaRate}%)</Text>
            <Text style={styles.totalValue}>{fmtMoney(data.ivaAmount)}</Text>
          </View>
          {hasIrpf ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.irpf} ({data.irpfRate}%)</Text>
              <Text style={styles.totalValue}>-{fmtMoney(data.irpfAmount!)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>{t.grandTotal}</Text>
            <Text style={styles.grandValue}>{fmtMoney(data.total)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          {data.paymentMethod ? (
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>{t.paymentMethod}</Text>
              <Text style={styles.footerValue}>{data.paymentMethod}</Text>
            </View>
          ) : <View />}
          {data.company.bankAccount ? (
            <View style={[styles.footerBlock, { alignItems: 'flex-end' }]}>
              <Text style={styles.footerLabel}>{t.bankAccount}</Text>
              <Text style={styles.footerValue}>{data.company.bankAccount}</Text>
            </View>
          ) : null}
        </View>

        {data.notes ? (
          <View style={styles.notes}>
            <Text style={styles.footerLabel}>{t.notes}</Text>
            <Text style={styles.footerValue}>{data.notes}</Text>
          </View>
        ) : null}

        {data.kind === 'invoice' ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{t.disclaimer}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

export async function renderDocumentPdf(data: PdfDocumentData) {
  return renderToStream(<DocumentPdf data={data} />)
}