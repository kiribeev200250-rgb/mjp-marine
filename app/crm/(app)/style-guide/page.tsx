import { Button, Badge, Input, Select, Textarea, Card, KpiCard, SectionHeader, DataTable } from '@/components/crm/ui'
import type { Column } from '@/components/crm/ui/DataTable'

export const metadata = { title: 'Style Guide — MJP CRM' }

// ─── Demo data ────────────────────────────────────────────────────────────────
const TONE_LIST = ['success', 'warning', 'danger', 'info', 'neutral'] as const
const BTN_VARIANTS = ['primary', 'secondary', 'danger', 'ghost'] as const
const BTN_SIZES = ['sm', 'md', 'lg'] as const

interface Row { id: string; name: string; status: string; amount: string }
const TABLE_COLS: Column<Row>[] = [
  { key: 'name',   header: 'Клиент',  render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
  { key: 'status', header: 'Статус',  render: (r) => <Badge tone="info">{r.status}</Badge> },
  { key: 'amount', header: 'Сумма',   render: (r) => <span className="tabular-nums font-medium">{r.amount}</span> },
]
const TABLE_ROWS: Row[] = [
  { id: '1', name: 'Капитан Марин', status: 'Запланировано', amount: '1 250,00 €' },
  { id: '2', name: 'Иван Волков',   status: 'В работе',      amount: '3 400,00 €' },
  { id: '3', name: 'Hans Müller',   status: 'Выставлен счёт', amount: '780,00 €'  },
]

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-heading font-bold text-gray-900 border-b border-gray-200 pb-2">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-label text-gray-500 w-32 shrink-0">{label}</span>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StyleGuidePage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-12">
      <div>
        <h1 className="text-display font-bold text-gray-900">MJP CRM — Style Guide</h1>
        <p className="text-body text-gray-500 mt-1">
          Живой референс компонентов и токенов дизайн-системы.
          Правило №1: не хардкодь цвета/размеры — только через эти токены.
        </p>
      </div>

      {/* ── Цвета ── */}
      <Section title="Цветовые токены">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['bg-navy',         'navy',        '#0A2342'],
            ['bg-navy-900',     'navy-900',    '#061729'],
            ['bg-gold',         'gold',        '#C9A84C'],
            ['bg-gold-light',   'gold-light',  '#E8C96A'],
            ['bg-success',      'success',     '#27AE60'],
            ['bg-danger',       'danger',      '#C0392B'],
            ['bg-info',         'info',        '#2980B9'],
            ['bg-warning',      'warning',     '#E67E22'],
            ['bg-gray-900',     'gray-900',    '#101828'],
            ['bg-gray-500',     'gray-500',    '#6B7688'],
            ['bg-gray-200',     'gray-200',    '#E2E5EA'],
            ['bg-gray-50',      'gray-50',     '#F7F8FA'],
          ] as [string, string, string][]).map(([cls, name, hex]) => (
            <div key={name} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-control border border-gray-200/40 shrink-0 ${cls}`} />
              <div>
                <p className="text-label font-medium text-gray-900">{name}</p>
                <p className="text-[10px] text-gray-500">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Типография ── */}
      <Section title="Типография (Inter)">
        <div className="space-y-3">
          <div><span className="text-display font-bold text-gray-900">text-display — 32px Bold</span></div>
          <div><span className="text-heading font-bold text-gray-900">text-heading — 22px Bold</span></div>
          <div><span className="text-subheading font-semibold text-gray-900">text-subheading — 16px Semibold</span></div>
          <div><span className="text-body text-gray-900">text-body — 14px Regular (основной текст)</span></div>
          <div><span className="text-label text-gray-500">text-label — 12px Regular (подписи, метки)</span></div>
          <div><span className="text-body tabular-nums text-gray-900">1 234,56 € — tabular-nums (деньги)</span></div>
          <div><span className="text-body tabular-nums text-danger">-320,00 € — отрицательная сумма</span></div>
        </div>
      </Section>

      {/* ── Кнопки ── */}
      <Section title="Button">
        <div className="space-y-4">
          {BTN_VARIANTS.map((variant) => (
            <Row key={variant} label={variant}>
              {BTN_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>{size}</Button>
              ))}
              <Button variant={variant} loading>Loading</Button>
              <Button variant={variant} disabled>Disabled</Button>
            </Row>
          ))}
        </div>
      </Section>

      {/* ── Badges ── */}
      <Section title="Badge">
        <Row label="тоны">
          {TONE_LIST.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
        </Row>
        <Row label="воронка">
          {(['NEW_LEAD','CONTACT_MADE','QUOTE_SENT','WORK_SCHEDULED','WORK_DONE','INVOICE_SENT','PAID'] as const).map((s) => (
            <Badge key={s} tone={
              s === 'NEW_LEAD' || s === 'CONTACT_MADE' || s === 'WORK_SCHEDULED' ? 'info'
              : s === 'WORK_DONE' || s === 'PAID' ? 'success'
              : s === 'INVOICE_SENT' ? 'warning'
              : 'neutral'
            }>{s}</Badge>
          ))}
        </Row>
        <Row label="задачи">
          {(['NEW','SCHEDULED','IN_PROGRESS','DONE','PROBLEM','CANCELLED_BY_CLIENT'] as const).map((s) => (
            <Badge key={s} tone={
              s === 'NEW' ? 'neutral'
              : s === 'SCHEDULED' ? 'info'
              : s === 'IN_PROGRESS' ? 'warning'
              : s === 'DONE' ? 'success'
              : s === 'PROBLEM' ? 'danger'
              : 'neutral'
            }>{s}</Badge>
          ))}
        </Row>
      </Section>

      {/* ── Inputs ── */}
      <Section title="Input / Select / Textarea">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Input label="Текстовое поле" placeholder="Введите текст..." />
          <Input label="С ошибкой" placeholder="Введите текст..." error="Поле обязательно" />
          <Input label="Отключено" placeholder="Недоступно" disabled />
          <Input label="Дата" type="date" />
          <Select label="Выбор">
            <option value="">— выберите —</option>
            <option value="1">Опция 1</option>
            <option value="2">Опция 2</option>
          </Select>
          <Input label="Email" type="email" placeholder="user@example.com" />
          <div className="sm:col-span-2">
            <Textarea label="Многострочное" rows={3} placeholder="Описание задачи..." />
          </div>
        </div>
      </Section>

      {/* ── Cards ── */}
      <Section title="Card / KpiCard">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="Активных клиентов" value="24" delta="+3 за месяц" deltaTone="success" />
          <KpiCard label="Выручка (EUR)"      value="12 400 €" delta="-800 € vs прошлый" deltaTone="danger" />
          <KpiCard label="Задач на неделе"    value="7" />
        </div>
        <Card className="p-4 mt-4">
          <SectionHeader title="Заголовок секции" action={<Button size="sm">Действие</Button>} />
          <p className="text-body text-gray-500 mt-2">Базовая карточка Card с SectionHeader. Используй для группировки контента внутри страницы.</p>
        </Card>
      </Section>

      {/* ── DataTable ── */}
      <Section title="DataTable">
        <DataTable<Row> columns={TABLE_COLS} rows={TABLE_ROWS} keyField="id" />
        <p className="text-label text-gray-500 mt-2">Loading state:</p>
        <DataTable<Row> columns={TABLE_COLS} rows={[]} keyField="id" loading />
        <p className="text-label text-gray-500 mt-2">Empty state:</p>
        <DataTable<Row> columns={TABLE_COLS} rows={[]} keyField="id" emptyText="Нет клиентов" />
      </Section>

      {/* ── Тени ── */}
      <Section title="Тени (box-shadow)">
        <div className="flex gap-6 flex-wrap">
          {(['e1','e2','e3','e4'] as const).map((e) => (
            <div key={e} className={`bg-white rounded-card px-6 py-4 shadow-${e} border border-gray-200/40`}>
              <p className="text-label text-gray-500">shadow-{e}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Радиусы ── */}
      <Section title="Border Radius">
        <div className="flex gap-6 flex-wrap items-center">
          {([
            ['rounded-card',    '10px', 'bg-navy/10'],
            ['rounded-control', '8px',  'bg-gold/10'],
            ['rounded-chip',    '999px','bg-info/10'],
          ] as [string, string, string][]).map(([cls, size, bg]) => (
            <div key={cls} className="text-center">
              <div className={`w-16 h-16 ${cls} ${bg} border border-gray-200`} />
              <p className="text-[10px] text-gray-500 mt-1">{cls}</p>
              <p className="text-label text-gray-500">{size}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Checklist ── */}
      <Section title="Правила работы с токенами">
        <ul className="space-y-2 text-body text-gray-900">
          {[
            'Цвета только через токены: text-navy, bg-gold, text-danger — не хардкодь hex',
            'Размеры шрифта: text-display / heading / subheading / body / label — не px напрямую',
            'Отступы: пространственная шкала Tailwind (p-4, gap-6) — без произвольных значений',
            'Деньги: Intl.NumberFormat ru-RU EUR + tabular-nums + красный при отрицательных',
            'Карточки: bg-white rounded-card shadow-e2 border border-gray-200',
            'Форма: bg-gray-50 + белые карточки — не dark glassmorphism в content area',
            'Shell (sidebar/topbar): bg-navy-900 — всегда тёмный',
            'Кнопки: только через <Button> из ui/Button.tsx — не самодельные',
            'Бейджи: только через <Badge tone="..."> — не самодельные span с bg-*',
          ].map((rule, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-success shrink-0">✓</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}