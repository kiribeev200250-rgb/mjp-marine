import path from 'node:path'
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToStream } from '@react-pdf/renderer'

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
const GRID = '#D6DCE5'

const styles = StyleSheet.create({
  page:      { fontFamily: 'Roboto', fontSize: 9.5, padding: 36, color: '#1a1a2e' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, backgroundColor: NAVY, padding: 18, borderRadius: 6 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center' },
  logo:        { width: 40, height: 40, marginRight: 12, borderRadius: 4 },
  companyName: { color: '#fff', fontSize: 15, fontWeight: 700 },
  companySub:  { color: 'rgba(255,255,255,0.65)', fontSize: 8.5, marginTop: 2 },
  docBadge:    { color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  docNumber:   { color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 2 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: GRID },
  metaBlock: { maxWidth: '48%' },
  metaLabel: { fontSize: 7.5, color: '#8892a6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { fontSize: 10, color: '#1a1a2e', fontWeight: 700 },
  metaLine:  { fontSize: 9, color: '#4a5568', marginTop: 1 },
  table:     { borderWidth: 1, borderColor: GRID, borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  tHeadRow:  { flexDirection: 'row', backgroundColor: '#EEF1F5', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1.5, borderBottomColor: NAVY },
  tHeadCell: { fontSize: 7.3, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, borderRightWidth: 1, borderRightColor: GRID },
  jobRow:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: GRID, borderLeftWidth: 3, borderLeftColor: GOLD },
  jobCell:   { fontSize: 9.5, color: NAVY, fontWeight: 700, borderRightWidth: 1, borderRightColor: GRID },
  matRow:    { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: '#FAFBFC', borderBottomWidth: 1, borderBottomColor: GRID, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  matCell:   { fontSize: 9, color: '#4a5568', borderRightWidth: 1, borderRightColor: GRID },
  colNum:    { width: 22, paddingRight: 3 },
  colDesc:   { flex: 1, paddingRight: 4 },
  colDescMat:{ flex: 1, paddingLeft: 10, paddingRight: 4 },
  colHours:  { width: 32, textAlign: 'right', paddingRight: 4 },
  colRate:   { width: 44, textAlign: 'right', paddingRight: 4 },
  colQty:    { width: 32, textAlign: 'right', paddingRight: 4 },
  colPrice:  { width: 44, textAlign: 'right', paddingRight: 4 },
  colTotal:  { width: 58, textAlign: 'right', paddingRight: 2, borderRightWidth: 0 },
  totals:    { alignSelf: 'flex-end', width: 240, marginBottom: 20, borderWidth: 1, borderColor: GRID, borderRadius: 4, overflow: 'hidden' },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: GRID },
  totalLabel:{ fontSize: 9.5, color: '#4a5568' },
  totalValue:{ fontSize: 9.5, color: '#1a1a2e', fontWeight: 700 },
  grandRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, backgroundColor: NAVY, borderTopWidth: 2, borderTopColor: GOLD },
  grandLabel:{ fontSize: 10.5, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 },
  grandValue:{ fontSize: 15, color: GOLD, fontWeight: 700 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerBlock: { maxWidth: '48%' },
  footerLabel: { fontSize: 7.5, color: '#8892a6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  footerValue: { fontSize: 9, color: '#4a5568' },
  signatureRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 30 },
  signatureBlock: { width: 200, borderTopWidth: 1, borderTopColor: '#8892a6', paddingTop: 4 },
  signatureLabel: { fontSize: 8, color: '#8892a6' },
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
    hours: 'Часы', rate: 'Норма/ч',
    jobsTotal: 'Итого работа', materialsTotal: 'Итого материалы',
    iva: 'IVA', irpf: 'IRPF', grandTotal: 'Итого', paymentMethod: 'Способ оплаты',
    bankAccount: 'Банковский счёт', notes: 'Примечания', signature: 'Подпись клиента',
    disclaimer: 'Перед использованием сверьтесь с gestor’ом (бухгалтером) — документ носит информационный характер.',
  },
  en: {
    invoice: 'INVOICE', quote: 'QUOTE', billTo: 'Bill to', date: 'Date',
    dueDate: 'Due date', validUntil: 'Valid until', description: 'Description',
    qty: 'Qty', unitPrice: 'Unit price', total: 'Total', subtotal: 'Subtotal',
    hours: 'Hours', rate: 'Rate/h',
    jobsTotal: 'Labor total', materialsTotal: 'Materials total',
    iva: 'VAT', irpf: 'IRPF', grandTotal: 'Total', paymentMethod: 'Payment method',
    bankAccount: 'Bank account', notes: 'Notes', signature: 'Client signature',
    disclaimer: 'Please verify with your gestor (accountant) before use — this document is informational.',
  },
  es: {
    invoice: 'FACTURA', quote: 'PRESUPUESTO', billTo: 'Cliente', date: 'Fecha',
    dueDate: 'Vencimiento', validUntil: 'Válido hasta', description: 'Descripción',
    qty: 'Cant.', unitPrice: 'Precio', total: 'Importe', subtotal: 'Base imponible',
    hours: 'Horas', rate: 'Tarifa/h',
    jobsTotal: 'Total mano de obra', materialsTotal: 'Total materiales',
    iva: 'IVA', irpf: 'IRPF', grandTotal: 'Total', paymentMethod: 'Forma de pago',
    bankAccount: 'Cuenta bancaria', notes: 'Notas', signature: 'Conforme el cliente',
    disclaimer: 'Verifique con su gestor antes de usar este documento — tiene carácter informativo.',
  },
  uk: {
    invoice: 'РАХУНОК', quote: 'КОШТОРИС', billTo: 'Отримувач', date: 'Дата',
    dueDate: 'Термін оплати', validUntil: 'Дійсний до', description: 'Опис',
    qty: 'К-сть', unitPrice: 'Ціна', total: 'Сума', subtotal: 'База',
    hours: 'Години', rate: 'Ставка/год',
    jobsTotal: 'Разом роботи', materialsTotal: 'Разом матеріали',
    iva: 'ПДВ', irpf: 'IRPF', grandTotal: 'Разом', paymentMethod: 'Спосіб оплати',
    bankAccount: 'Банківський рахунок', notes: 'Примітки', signature: 'Підпис клієнта',
    disclaimer: 'Перед використанням звірте з gestor’ом (бухгалтером) — документ має інформаційний характер.',
  },
  pl: {
    invoice: 'FAKTURA', quote: 'WYCENA', billTo: 'Nabywca', date: 'Data',
    dueDate: 'Termin płatności', validUntil: 'Ważne do', description: 'Opis',
    qty: 'Ilość', unitPrice: 'Cena', total: 'Suma', subtotal: 'Podstawa',
    hours: 'Godziny', rate: 'Stawka/h',
    jobsTotal: 'Suma robocizny', materialsTotal: 'Suma materiałów',
    iva: 'VAT', irpf: 'IRPF', grandTotal: 'Razem', paymentMethod: 'Sposób płatności',
    bankAccount: 'Konto bankowe', notes: 'Uwagi', signature: 'Podpis klienta',
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

export interface PdfMaterial {
  name:      string
  quantity:  string
  unitPrice: string
  total:     string
}

export interface PdfJob {
  title:      string
  laborHours?: string | null
  laborRate?:  string | null
  laborCost:  string
  materials:  PdfMaterial[]
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
  logoUrl?:    string | null
}

export interface PdfDocumentData {
  kind:           'invoice' | 'quote'
  number:         string
  date:           Date | string
  dueDate?:       Date | string | null
  validUntil?:    Date | string | null
  language:       string
  company:        PdfCompanyInfo
  clientName:     string
  clientNif?:     string
  clientAddress?: string
  jobs:           PdfJob[]
  jobsTotal:      string
  materialsTotal: string
  subtotal:       string
  ivaRate:        string
  ivaAmount:      string
  irpfRate?:      string
  irpfAmount?:    string
  total:          string
  paymentMethod?: string
  notes?:         string
}

function DocumentPdf({ data }: { data: PdfDocumentData }) {
  const lang = resolveLang(data.language)
  const t = T[lang]
  const hasIrpf = data.irpfAmount != null && parseFloat(data.irpfAmount) !== 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.company.logoUrl ? <Image style={styles.logo} src={data.company.logoUrl} /> : null}
            <View>
              <Text style={styles.companyName}>{data.company.legalName}</Text>
              <Text style={styles.companySub}>
                {data.company.address}, {data.company.city}
                {data.company.postalCode ? ` ${data.company.postalCode}` : ''}, {data.company.country}
              </Text>
              <Text style={styles.companySub}>NIF: {data.company.nif}</Text>
            </View>
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
            <Text style={[styles.tHeadCell, styles.colNum]}> </Text>
            <Text style={[styles.tHeadCell, styles.colDesc]}>{t.description}</Text>
            <Text style={[styles.tHeadCell, styles.colHours]}>{t.hours}</Text>
            <Text style={[styles.tHeadCell, styles.colRate]}>{t.rate}</Text>
            <Text style={[styles.tHeadCell, styles.colQty]}>{t.qty}</Text>
            <Text style={[styles.tHeadCell, styles.colPrice]}>{t.unitPrice}</Text>
            <Text style={[styles.tHeadCell, styles.colTotal]}>{t.total}</Text>
          </View>
          {data.jobs.map((job, ji) => (
            <View key={ji}>
              <View style={styles.jobRow}>
                <Text style={[styles.jobCell, styles.colNum]}>{ji + 1}</Text>
                <Text style={[styles.jobCell, styles.colDesc]}>{job.title}</Text>
                <Text style={[styles.jobCell, styles.colHours]}>{job.laborHours ?? '—'}</Text>
                <Text style={[styles.jobCell, styles.colRate]}>{job.laborRate ? fmtMoney(job.laborRate) : '—'}</Text>
                <Text style={[styles.jobCell, styles.colQty]}>—</Text>
                <Text style={[styles.jobCell, styles.colPrice]}>—</Text>
                <Text style={[styles.jobCell, styles.colTotal]}>{fmtMoney(job.laborCost)}</Text>
              </View>
              {job.materials.map((mat, mi) => (
                <View key={mi} style={styles.matRow}>
                  <Text style={[styles.matCell, styles.colNum]}>{ji + 1}.{mi + 1}</Text>
                  <Text style={[styles.matCell, styles.colDescMat]}>{mat.name}</Text>
                  <Text style={[styles.matCell, styles.colHours]}>—</Text>
                  <Text style={[styles.matCell, styles.colRate]}>—</Text>
                  <Text style={[styles.matCell, styles.colQty]}>{mat.quantity}</Text>
                  <Text style={[styles.matCell, styles.colPrice]}>{fmtMoney(mat.unitPrice)}</Text>
                  <Text style={[styles.matCell, styles.colTotal]}>{fmtMoney(mat.total)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.jobsTotal}</Text>
            <Text style={styles.totalValue}>{fmtMoney(data.jobsTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.materialsTotal}</Text>
            <Text style={styles.totalValue}>{fmtMoney(data.materialsTotal)}</Text>
          </View>
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

        {data.kind === 'quote' ? (
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>{t.signature}</Text>
            </View>
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