# MJP Marine CRM — Архитектура

## Репозиторий

CRM строится **внутри существующего проекта сайта** (mjpmarine.com). Единый
деплой на Vercel, единый `.env`, общий Supabase-проект, общий Prisma-клиент.

---

## Структура папок (предлагаемая)

```
/
├── app/
│   ├── (public)/              # существующий публичный сайт — не трогаем
│   ├── admin/                 # существующая CMS сайта — не трогаем
│   ├── go/                    # существующий пресайт QR — не трогаем
│   │
│   ├── crm/                   # ← НОВОЕ: CRM-приложение
│   │   ├── login/             # страница входа в CRM (/crm/login)
│   │   │   └── page.tsx
│   │   └── (app)/             # auth-защищённые маршруты (middleware)
│   │       ├── layout.tsx     # CRM shell: sidebar + topbar
│   │       ├── page.tsx       # редирект → /crm/(app)/dashboard
│   │       ├── dashboard/     # главный дашборд
│   │       ├── clients/       # клиенты (список + карточка 360°)
│   │       ├── funnel/        # канбан-воронка
│   │       ├── schedule/      # планировщик + бэклог
│   │       ├── inventory/     # склад
│   │       ├── finance/       # финансы (операции + мини-дашборд)
│   │       ├── invoices/      # пресметы и счета
│   │       ├── reports/       # аналитика и отчёты
│   │       └── settings/      # настройки (компания, RBAC, реквизиты, FB)
│   │
│   ├── api/
│   │   ├── auth/              # существующий next-auth для CMS
│   │   ├── crm/
│   │   │   ├── auth/          # [...nextauth] — отдельный auth для CRM
│   │   │   ├── webhook/
│   │   │   │   ├── telegram/  # grammY webhook
│   │   │   │   ├── facebook/  # FB Lead Ads webhook (готов, по умолчанию выкл.)
│   │   │   │   └── sheets/    # Apps Script onEdit → синк таблица→база
│   │   │   └── cron/
│   │   │       ├── reminders/ # Vercel Cron: напоминания, просрочки
│   │   │       └── sheets-sync/ # Vercel Cron: пуллинг таблицы
│   │   └── ...                # существующие api routes — не трогаем
│   │
│   ├── quotes/[token]/        # публичная ссылка «принять пресмет»
│   │   └── page.tsx
│   │
│   ├── layout.tsx             # root layout — не трогаем
│   └── globals.css
│
├── components/
│   ├── admin/                 # существующие — не трогаем
│   ├── landing/               # существующие — не трогаем
│   ├── ui/                    # общий UI kit (shadcn/ui, стилизован под бренд)
│   └── crm/                   # ← НОВОЕ: CRM-компоненты
│       ├── layout/            # CrmSidebar, CrmTopbar, CrmBreadcrumbs
│       ├── clients/           # ClientCard, ClientTimeline, ClientForm
│       ├── funnel/            # KanbanBoard, KanbanColumn, KanbanCard
│       ├── schedule/          # CalendarView, TaskBacklog, TaskForm
│       ├── inventory/         # InventoryTable, StockMovementForm
│       ├── finance/           # FinanceForm, FinanceDashboard, ReceiptUpload
│       ├── invoices/          # InvoiceForm, PdfPreview, QuoteAccept
│       └── shared/            # DataTable, StatusBadge, AuditLog, CmdK
│
├── lib/
│   ├── auth.ts                # существующий CMS auth — не трогаем
│   ├── prisma.ts              # существующий — не трогаем
│   ├── resend.ts              # существующий — не трогаем
│   └── crm/                   # ← НОВОЕ: CRM бизнес-логика
│       ├── auth.ts            # CRM authOptions + RBAC helpers
│       ├── permissions.ts     # матрица прав: модуль × действие
│       ├── audit.ts           # запись в AuditLog
│       ├── finance.ts         # финансовые формулы (Decimal, P&L, касса)
│       ├── sheets.ts          # Google Sheets синк (база → таблица)
│       ├── drive.ts           # загрузка чеков в Google Drive
│       ├── telegram.ts        # grammY bot instance + handlers
│       ├── pdf.ts             # генерация PDF счетов (@react-pdf/renderer)
│       └── ocr.ts             # OCR чеков (предзаполнение расходов)
│
├── prisma/
│   └── schema.prisma          # расширен CRM-моделями (отдельный namespace)
│
└── middleware.ts              # расширить: /crm/(app)/* → проверка CRM-сессии
```

---

## Граница сайт ↔ CRM

| Аспект | Сайт | CRM |
|---|---|---|
| Маршруты | `/(public)`, `/admin`, `/go` | `/crm` |
| Auth | next-auth → `AdminUser` | next-auth (отдельные options) → `CrmUser` |
| DB-таблицы | `SiteConfig`, `GalleryItem`, … | `crm_*` — префикс или отдельная Prisma-схема |
| Supabase RLS | без RLS (только серверный код) | строгие RLS-политики по `company_id` |
| Деплой | общий Vercel | общий Vercel |
| Зависимости | нет от CRM | нет от сайта (кроме UI-kit и i18n) |

---

## Auth и RBAC

### CRM Auth
- Отдельный `authOptions` в `lib/crm/auth.ts`, смонтирован на `/api/crm/auth/[...nextauth]`.
- Credentials provider → `CrmUser` в Prisma (bcrypt-пароль).
- JWT содержит: `userId`, `companyId`, `role` (`ADMIN` | `EMPLOYEE`), `permissions` (JSON-матрица).
- Middleware (`middleware.ts`) проверяет `/crm/(app)/*`: нет сессии → редирект `/crm/login`.

### Матрица прав (RBAC)
```
Модули: CLIENTS, FUNNEL, SCHEDULE, INVENTORY, FINANCE, INVOICES, REPORTS, SETTINGS
Права:  VIEW, CREATE, EDIT, DELETE

Роль ADMIN:     все модули × все права
Роль EMPLOYEE:  настраивается поэлементно через UI
```
- Проверка прав — **всегда на сервере** (Server Actions / Route Handlers).
- UI прячет недоступные элементы на основе тех же пермишнов из сессии.

---

## База данных

Одна Supabase Postgres БД, один Prisma-клиент. CRM-модели отличаются от
сайтовых префиксом (концептуально) — в Prisma они просто разные модели.

Supabase RLS на CRM-таблицах: все операции разрешены только для `service_role`
(backend) или аутентифицированных пользователей своей компании (если в будущем
понадобится прямой Supabase-клиент). Сейчас весь доступ — только через Prisma
на сервере (route handlers / server actions).

---

## Единый источник правды

```
Supabase Postgres (Prisma)
       ↑↓                ↑↓               ↑↓
  Веб-CRM          Telegram-бот     Google Sheets
(Server Actions)  (grammY webhook)  (Sheets API)

Любое изменение пишет в базу через один сервисный слой (lib/crm/).
Google Sheets — зеркало, не источник истины.
```

Синхронизация:
- **База → Sheets:** при каждой финансовой операции — `lib/crm/sheets.ts`.
- **Sheets → База:** Apps Script `onEdit` → webhook `/api/crm/webhook/sheets` ИЛИ
  Vercel Cron (`/api/crm/cron/sheets-sync`). Реализуется на Этапе 8.
- **Аудит-лог:** каждая мутация денег/склада/статусов пишет запись в `AuditLog`.

---

## Ключевые технические решения

### Деньги — Decimal, не float
Все денежные поля в Prisma — `Decimal` (Postgres `NUMERIC(12,2)`).
В бизнес-логике — библиотека `decimal.js` или встроенный Prisma Decimal.
Никаких `number` для денег.

### PDF счетов — @react-pdf/renderer
Выбор между `@react-pdf/renderer` и `pdf-lib`:
- `@react-pdf/renderer`: React-компоненты → PDF; легче верстать мультиязычные
  шаблоны с кириллицей; поддерживает кастомные шрифты.
- `pdf-lib`: низкоуровневый, без кириллицы из коробки.
→ **Выбираем `@react-pdf/renderer`**. Генерация на сервере (Node.js).

### i18n
CRM UI — русский (основной). Шаблоны PDF счетов — мультиязычные (RU/EN/ES/UK/PL).
Переиспользуем `lib/i18n.ts` сайта для PDF-переводов, CRM UI — хардкод RU
с возможностью добавить `next-intl` позже.

### Telegram-бот — grammY
Webhook на `/api/crm/webhook/telegram`. Serverless-совместимый (grammY поддерживает).
Bot instance инициализируется в `lib/crm/telegram.ts`.

---

## Переменные окружения (новые для CRM)

```env
# Google Service Account (для Sheets + Drive)
GOOGLE_SA_CLIENT_EMAIL=...
GOOGLE_SA_PRIVATE_KEY=...
GOOGLE_SHEETS_ID=1_nFTlprxT8imeA81awGMwpVd74l0f381eViLxDJNBjE

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...

# CRM Auth (отдельный secret от CMS)
CRM_NEXTAUTH_SECRET=...

# OCR (опционально — Google Vision API или Tesseract)
GOOGLE_VISION_API_KEY=...

# Facebook (добавится на финальном этапе)
# FB_APP_ID=...
# FB_PAGE_ACCESS_TOKEN=...
# FB_VERIFY_TOKEN=...
```

---

## Порядок реализации (Этапы)

| Этап | Что делаем | Зависимости |
|------|-----------|-------------|
| 0 | ARCHITECTURE.md + SPEC.md + Prisma-схема | — |
| 1 | Auth + RBAC + UI-каркас (sidebar, бренд, layout) | схема |
| 2 | Клиенты + воронка (канбан, карточка, CSV) | этап 1 |
| 3 | Планировщик (календарь, drag-drop, бэклог) | этап 2 |
| 4 | Склад (движения, алерты, автосписание) | этап 3 |
| 5 | Финансы + Google Sheets синк | этап 4 + Google SA |
| 6 | Пресметы + счета (PDF, IVA, публичная ссылка) | этап 5 |
| 7 | Telegram-бот (все функции) | этапы 1–6 |
| 8 | Аналитика, Cron, синк Sheets→База, FB-опция | все этапы |