# MJP Marine CRM — Функциональная спецификация

## Контекст

**MJP Marine Service** — мобильный сервис ремонта яхт, Коста-Бланка (Испания).
~13 марин от Дении до Картахены. CRM встроена в существующий сайт mjpmarine.com.
UI на русском, шаблоны счетов — мультиязычные.

---

## Prisma-схема (CRM-модели)

```prisma
// ─── КОМПАНИЯ И ПОЛЬЗОВАТЕЛИ ────────────────────────────────────────────────

model Company {
  id          String   @id @default(cuid())
  name        String
  createdAt   DateTime @default(now())

  users       CrmUser[]
  clients     Client[]
  tasks       Task[]
  inventory   InventoryItem[]
  finances    FinanceEntry[]
  capitals    CapitalEntry[]
  invoices    Invoice[]
  quotes      Quote[]
  references  ReferenceItem[]
  auditLogs   AuditLog[]
  companyInfo CompanyInfo?
}

model CrmUser {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  email       String   @unique
  password    String   // bcrypt
  name        String
  role        CrmRole  @default(EMPLOYEE)
  permissions Json     @default("{}") // { "CLIENTS": ["VIEW","CREATE"], ... }
  telegramId  String?  @unique
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks       Task[]   @relation("assignee")
  auditLogs   AuditLog[]
}

enum CrmRole {
  ADMIN
  EMPLOYEE
}

// Реквизиты компании для счетов (autónomo или S.L.)
model CompanyInfo {
  id              String  @id @default(cuid())
  companyId       String  @unique
  company         Company @relation(fields: [companyId], references: [id])
  legalName       String  @default("ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ")
  nif             String  @default("ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ")
  address         String  @default("ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ")
  city            String  @default("ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ")
  postalCode      String  @default("ЗАПОЛНИТЬ ПЕРЕД ИСПОЛЬЗОВАНИЕМ")
  country         String  @default("España")
  email           String  @default("")
  phone           String  @default("")
  bankAccount     String  @default("") // IBAN для переводов
  logoUrl         String?
  ivaRate         Decimal @default(21) @db.Decimal(5,2)
  irpfRate        Decimal @default(0)  @db.Decimal(5,2)
  invoicePrefix   String  @default("F")   // F2025-001
  quotePrefix     String  @default("P")   // P2025-001
  nextInvoiceNum  Int     @default(1)
  nextQuoteNum    Int     @default(1)
  currentYear     Int     @default(2025)
  fbEnabled       Boolean @default(false) // Facebook Lead Ads
  fbAppId         String?
  fbPageToken     String?
  fbVerifyToken   String?
}

// ─── АУДИТ ──────────────────────────────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  userId      String?
  user        CrmUser? @relation(fields: [userId], references: [id])
  action      String   // CREATE | UPDATE | DELETE | STATUS_CHANGE | STOCK_MOVE | etc.
  entity      String   // FinanceEntry | StockMovement | Invoice | Task | ...
  entityId    String
  oldValue    Json?
  newValue    Json?
  meta        Json?    // дополнительный контекст
  createdAt   DateTime @default(now())

  @@index([companyId, entity, entityId])
  @@index([companyId, createdAt])
}

// ─── КЛИЕНТЫ И ВОРОНКА ──────────────────────────────────────────────────────

model Client {
  id          String        @id @default(cuid())
  companyId   String
  company     Company       @relation(fields: [companyId], references: [id])
  firstName   String
  lastName    String
  phone       String        @default("")
  email       String        @default("")
  source      ClientSource  @default(MANUAL)
  language    String        @default("ru") // ru | en | es | uk | pl
  marina      String        @default("")
  notes       String        @default("")
  funnelStage FunnelStage   @default(NEW_LEAD)
  active      Boolean       @default(true)
  fbLeadId    String?       // если пришёл из Facebook
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  yachts      Yacht[]
  quotes      Quote[]
  tasks       Task[]
  invoices    Invoice[]
  finances    FinanceEntry[]
  stageHistory FunnelHistory[]

  @@index([companyId, funnelStage])
  @@index([companyId, source])
}

enum ClientSource {
  FACEBOOK
  MANUAL
  REFERRAL
  WEBSITE
  WHATSAPP
  OTHER
}

enum FunnelStage {
  NEW_LEAD            // Новый лид
  CONTACT_MADE        // Контакт установлен
  QUOTE_SENT          // Предварительная оценка (пресмет)
  WORK_SCHEDULED      // Работа запланирована
  WORK_DONE           // Выполнено
  INVOICE_SENT        // Счёт выставлен
  PAID                // Оплачено
}

model FunnelHistory {
  id         String      @id @default(cuid())
  clientId   String
  client     Client      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  fromStage  FunnelStage?
  toStage    FunnelStage
  note       String      @default("")
  createdAt  DateTime    @default(now())
}

model Yacht {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  model     String   @default("")
  length    Decimal? @db.Decimal(5,2) // в метрах
  marina    String   @default("")
  notes     String   @default("")
  createdAt DateTime @default(now())
}

// ─── ПРЕСМЕТЫ (QUOTES) ──────────────────────────────────────────────────────

model Quote {
  id            String      @id @default(cuid())
  companyId     String
  company       Company     @relation(fields: [companyId], references: [id])
  clientId      String
  client        Client      @relation(fields: [clientId], references: [id])
  number        String      // P2025-001
  status        QuoteStatus @default(DRAFT)
  language      String      @default("ru")
  validUntil    DateTime?
  publicToken   String      @unique @default(cuid()) // /quotes/[token]
  acceptedAt    DateTime?
  ivaRate       Decimal     @db.Decimal(5,2) @default(21)
  subtotal      Decimal     @db.Decimal(12,2) @default(0)
  ivaAmount     Decimal     @db.Decimal(12,2) @default(0)
  total         Decimal     @db.Decimal(12,2) @default(0)
  notes         String      @default("")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  items         QuoteItem[]
  tasks         Task[]
  invoices      Invoice[]
}

enum QuoteStatus {
  DRAFT       // Черновик
  SENT        // Отправлен
  ACCEPTED    // Принят
  REJECTED    // Отклонён
}

model QuoteItem {
  id          String  @id @default(cuid())
  quoteId     String
  quote       Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  description String
  quantity    Decimal @db.Decimal(10,3)
  unitPrice   Decimal @db.Decimal(12,2)
  total       Decimal @db.Decimal(12,2)
  sortOrder   Int     @default(0)
}

// ─── ЗАДАЧИ / РАБОТЫ ────────────────────────────────────────────────────────

model Task {
  id           String     @id @default(cuid())
  companyId    String
  company      Company    @relation(fields: [companyId], references: [id])
  title        String
  description  String     @default("")
  clientId     String?
  client       Client?    @relation(fields: [clientId], references: [id])
  quoteId      String?
  quote        Quote?     @relation(fields: [quoteId], references: [id])
  assigneeId   String?
  assignee     CrmUser?   @relation("assignee", fields: [assigneeId], references: [id])
  marina       String     @default("")
  status       TaskStatus @default(NEW)
  scheduledAt  DateTime?
  startTime    DateTime?
  endTime      DateTime?
  isBacklog    Boolean    @default(false) // незапланированные
  checklist    Json       @default("[]")  // [{text, done}]
  photosBefore String[]   // Supabase Storage URLs
  photosAfter  String[]
  completedAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  stockUsage   StockMovement[]
  reminders    Reminder[]

  @@index([companyId, status])
  @@index([companyId, scheduledAt])
  @@index([companyId, marina])
}

enum TaskStatus {
  NEW         // Новая (серый)
  SCHEDULED   // Запланирована (синий)
  IN_PROGRESS // В работе (жёлтый)
  DONE        // Выполнена (зелёный)
  PROBLEM     // Проблема (красный)
}

// ─── СКЛАД ──────────────────────────────────────────────────────────────────

model InventoryItem {
  id              String   @id @default(cuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  name            String
  category        String   @default("")
  unit            String   @default("шт")
  qtyInStock      Decimal  @db.Decimal(10,3) @default(0)
  qtyOrdered      Decimal  @db.Decimal(10,3) @default(0) // заказано, не доставлено
  qtyMinAlert     Decimal  @db.Decimal(10,3) @default(0)
  costPrice       Decimal  @db.Decimal(12,2) @default(0) // закупочная
  sellPrice       Decimal  @db.Decimal(12,2) @default(0) // продажная
  supplier        String   @default("")
  notes           String   @default("")
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  movements       StockMovement[]

  @@index([companyId])
}

model StockMovement {
  id          String            @id @default(cuid())
  companyId   String            // денормализовано для RLS
  itemId      String
  item        InventoryItem     @relation(fields: [itemId], references: [id])
  taskId      String?
  task        Task?             @relation(fields: [taskId], references: [id])
  type        StockMovementType
  qty         Decimal           @db.Decimal(10,3)
  unitPrice   Decimal           @db.Decimal(12,2) @default(0)
  total       Decimal           @db.Decimal(12,2) @default(0)
  note        String            @default("")
  createdAt   DateTime          @default(now())

  @@index([companyId, type])
  @@index([itemId])
}

enum StockMovementType {
  RECEIVE      // Приёмка (заказ→наличие)
  WRITE_OFF    // Списание в работу
  SELL         // Продажа (создаёт FinanceEntry дохода)
  ADJUST       // Корректировка (инвентаризация)
  ORDER        // Заказ (→ qtyOrdered)
}

// ─── ФИНАНСЫ ────────────────────────────────────────────────────────────────

// Операционные записи: доходы / расходы / зарплаты (входят в P&L)
model FinanceEntry {
  id            String           @id @default(cuid())
  companyId     String
  company       Company          @relation(fields: [companyId], references: [id])
  autoId        String           @unique // EXP-2025-001 | INC-2025-001 | SAL-2025-001
  type          FinanceEntryType
  date          DateTime
  category      String           // из справочника ReferenceItem
  amountExpr    String           @default("") // введённое выражение, напр. "168.23/2"
  amount        Decimal          @db.Decimal(12,2)
  paymentMethod String           @default("") // наличные | карта | перевод
  description   String           @default("")
  clientId      String?
  client        Client?          @relation(fields: [clientId], references: [id])
  invoiceId     String?
  invoice       Invoice?         @relation(fields: [invoiceId], references: [id])
  receiptUrl    String?          // Google Drive link
  receiptDriveId String?         // Google Drive file ID
  sheetsSynced  Boolean          @default(false)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([companyId, type, date])
}

enum FinanceEntryType {
  INCOME   // Доход  (INC-)
  EXPENSE  // Расход (EXP-)
  SALARY   // Зарплата (SAL-)
}

// Вложения / инвестиции (НЕ входят в P&L)
model CapitalEntry {
  id            String            @id @default(cuid())
  companyId     String
  company       Company           @relation(fields: [companyId], references: [id])
  autoId        String            @unique // INV-2025-001
  type          CapitalEntryType
  date          DateTime
  source        String            @default("") // источник/назначение
  amount        Decimal           @db.Decimal(12,2)
  note          String            @default("")
  sheetsSynced  Boolean           @default(false)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([companyId, type, date])
}

// Типы вложений — строго три варианта
enum CapitalEntryType {
  REINVESTMENT    // Доинвестиции — попадают в кассу
  STARTUP_ASSET   // Стартовые — ушли в актив (фургон, инструмент, залог)
  STARTUP_SUNK    // Стартовые невозвратные (риелтор, первый месяц аренды)
}

// ─── СЧЕТА (FACTURAS) ────────────────────────────────────────────────────────

model Invoice {
  id             String        @id @default(cuid())
  companyId      String
  company        Company       @relation(fields: [companyId], references: [id])
  clientId       String
  client         Client        @relation(fields: [clientId], references: [id])
  quoteId        String?
  quote          Quote?        @relation(fields: [quoteId], references: [id])
  number         String        // F2025-001 (сквозной, per год)
  year           Int
  sequenceNum    Int           // порядковый номер в году
  status         InvoiceStatus @default(ISSUED)
  language       String        @default("ru")
  date           DateTime      @default(now())
  dueDate        DateTime?
  paymentMethod  String        @default("") // наличные | карта | перевод
  paidAt         DateTime?
  ivaRate        Decimal       @db.Decimal(5,2)  @default(21)
  irpfRate       Decimal       @db.Decimal(5,2)  @default(0)
  subtotal       Decimal       @db.Decimal(12,2)
  ivaAmount      Decimal       @db.Decimal(12,2)
  irpfAmount     Decimal       @db.Decimal(12,2) @default(0)
  total          Decimal       @db.Decimal(12,2)
  // Реквизиты клиента (снапшот на момент выпуска)
  clientName     String
  clientNif      String        @default("")
  clientAddress  String        @default("")
  notes          String        @default("")
  pdfUrl         String?       // Supabase Storage URL
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  items          InvoiceItem[]
  finances       FinanceEntry[]

  @@unique([companyId, year, sequenceNum])
  @@index([companyId, status])
}

enum InvoiceStatus {
  ISSUED      // Выставлен
  PARTIAL     // Частично оплачен
  PAID        // Оплачен
  OVERDUE     // Просрочен
  CANCELLED   // Отменён
}

model InvoiceItem {
  id          String  @id @default(cuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description String
  quantity    Decimal @db.Decimal(10,3)
  unitPrice   Decimal @db.Decimal(12,2)
  total       Decimal @db.Decimal(12,2)
  sortOrder   Int     @default(0)
}

// ─── СПРАВОЧНИКИ ────────────────────────────────────────────────────────────

model ReferenceItem {
  id        String        @id @default(cuid())
  companyId String
  company   Company       @relation(fields: [companyId], references: [id])
  type      ReferenceType
  value     String
  label     String
  sortOrder Int           @default(0)
  active    Boolean       @default(true)

  @@unique([companyId, type, value])
  @@index([companyId, type])
}

enum ReferenceType {
  EXPENSE_CATEGORY   // Категории расходов
  INCOME_CATEGORY    // Категории доходов
  PAYMENT_METHOD     // Способы оплаты
  CLIENT_SOURCE      // Источники клиентов
  MARINA             // Список марин
  TASK_STATUS        // Статусы задач (для справочника)
  INVENTORY_CATEGORY // Категории склада
}

// ─── НАПОМИНАНИЯ ────────────────────────────────────────────────────────────

model Reminder {
  id          String       @id @default(cuid())
  companyId   String
  type        ReminderType
  title       String
  scheduledAt DateTime
  clientId    String?
  taskId      String?
  task        Task?        @relation(fields: [taskId], references: [id])
  invoiceId   String?
  sent        Boolean      @default(false)
  sentAt      DateTime?
  createdAt   DateTime     @default(now())

  @@index([companyId, scheduledAt, sent])
}

enum ReminderType {
  INVOICE_OVERDUE    // Просрочка счёта
  STALE_LEAD         // Зависший лид
  SEASONAL_SERVICE   // Сезонное ТО (антифоулинг и т.д.)
  LOW_STOCK          // Низкий остаток склада
  CUSTOM             // Кастомное
}

// ─── KPI-ЦЕЛИ ────────────────────────────────────────────────────────────────

model KpiGoal {
  id        String   @id @default(cuid())
  companyId String
  month     Int      // 1-12
  year      Int
  revenue   Decimal  @db.Decimal(12,2) @default(0)
  margin    Decimal  @db.Decimal(12,2) @default(0)
  notes     String   @default("")
  createdAt DateTime @default(now())

  @@unique([companyId, year, month])
}
```

---

## Финансовая логика (критично)

### Три слоя денег

```
Вложения (CapitalEntry):
  REINVESTMENT       → попадают в кассу (+)
  STARTUP_ASSET      → НЕ в кассе, НЕ в P&L (активы)
  STARTUP_SUNK       → НЕ в кассе, НЕ в P&L (одноразовые затраты запуска)

P&L = SUM(INCOME) − SUM(EXPENSE) − SUM(SALARY)
      (из FinanceEntry, вложения НЕ включаем НИКОГДА)

Касса = SUM(REINVESTMENT) + SUM(INCOME) − SUM(EXPENSE) − SUM(SALARY)
        (из CapitalEntry.REINVESTMENT + FinanceEntry)

«Личные в проекте» = IF(Касса < 0; −Касса; 0)
```

### Паттерн финансирования из доинвестиций

Если кассы не хватает на лизинг или зарплату:
1. Создаём `CapitalEntry(REINVESTMENT, 652, "Renault")` → касса +652
2. Создаём `FinanceEntry(EXPENSE, "Лизинг / аренда авто", 652)` → касса −652
3. Итог по кассе: 0. В P&L: затрата 652 видна.

### Арифметика в поле суммы

Поле `amountExpr` хранит введённое выражение (напр. `"168.23/2"`).
При сохранении парсим и вычисляем `amount` в безопасном режиме
(допустимы только числа и операторы `+ - * /`; eval не использовать).

### Номера счетов (испанские требования)

Сквозной последовательный номер без пропусков, per год:
- Счёт: `F2025-001`, `F2025-002`, …
- Пресмет: `P2025-001`, `P2025-002`, …

При создании — `SELECT ... FOR UPDATE` (транзакция) для атомарного инкремента
`CompanyInfo.nextInvoiceNum`. Если год сменился — сброс до 1.

---

## Модули — функциональные требования

### М1. Клиенты + воронка

**Список клиентов:**
- Таблица с поиском, фильтрами (марина, источник, стадия воронки, период).
- Быстрое добавление клиента (имя, телефон, марина — минимум).
- CSV-импорт: шаблон для скачивания, валидация, предпросмотр перед импортом.

**Карточка клиента (360°):**
- Контакты, язык, марина, яхты.
- Таймлайн: лиды → пресметы → задачи → счета → платежи → заметки.
- Все связанные сущности кликабельны.

**Канбан-воронка:**
- 7 колонок = 7 стадий `FunnelStage`.
- Drag-and-drop карточек; при перетаскивании → запись в `FunnelHistory` + аудит.
- Каждая карточка: имя, марина, источник, последняя активность, сумма открытых счетов.
- Фильтры над доской.

**FB Lead Ads (ОТКЛЮЧЕНО по умолчанию):**
- Экран в настройках: поля FB App ID, Page Token, Verify Token.
- Webhook `/api/crm/webhook/facebook` — принимает лиды, создаёт клиента.
- Флаг `CompanyInfo.fbEnabled` — если false, webhook отвечает 200 но ничего не делает.

### М2. Планировщик задач

**Виды:** месяц / неделя / день — переключатель сверху.

**Календарь:**
- Сетка часов (8:00–20:00 на день/неделю).
- Клик по ячейке → форма создания задачи с датой/временем.
- Drag-and-drop для переноса; ресайз для изменения длительности.
- Цвет события = цвет статуса.

**Бэклог:**
- Панель сбоку «Незапланированные задачи».
- Быстрое добавление одной строкой (только заголовок).
- Перетаскивание из бэклога в календарь.
- Из Telegram: сообщение → задача в бэклог.

**Оптимизация маршрута:**
- После создания задачи на дату X: если в тот же день есть другие задачи в той же марине → тост/подсказка.

**Форма задачи:**
- Заголовок, описание, клиент, пресмет, марина.
- Исполнитель (выбор из сотрудников).
- Чек-лист (добавить / отметить пункт).
- Фото до/после — загрузка в Supabase Storage.
- Использованные материалы — поиск по складу, qty, списание.

**Автосписание:**
При переводе задачи в статус `DONE` — если есть привязанные материалы и они
ещё не списаны — автоматически создаём `StockMovement(WRITE_OFF)`.

### М3. Склад

**Таблица товаров:**
- Поиск, фильтр по категории.
- Колонки: название, категория, ед. изм., в наличии, заказано, мин. остаток, цена.
- Строки с остатком < мин. — подсвечены красным.

**Карточка товара:**
- История движений (StockMovement).
- Кнопки: приёмка / заказ / списание / продажа / корректировка.

**Алерты:**
- На дашборде: список товаров с остатком < мин.
- Telegram: уведомление при списании если остаток падает ниже мин.

**Продажа со склада:**
- Создаёт `StockMovement(SELL)` + `FinanceEntry(INCOME)` автоматически.

### М4. Финансы

**Форма ввода операции:**
- Тип (Доход / Расход / Зарплата / Доинвестиция) — выбор меняет форму.
- Дата, категория (справочник), сумма (поле принимает `168.23/2`).
- Способ оплаты, описание.
- Прикрепить чек → загрузка в Google Drive → ссылка сохраняется.
- OCR кнопка рядом с загрузкой — парсит сумму/дату/поставщика, подставляет в поля.

**Таблица операций:**
- Фильтры: тип, дата, категория, способ оплаты.
- Редактирование inline.
- Экспорт в формат книги.

**Мини-дашборд (виджет на главной + отдельная страница):**
```
Касса: X €
P&L этого месяца: X € (доходы X − расходы X − зарплаты X)
Вложено всего: X €  |  Стартовые активы: X €  |  Личные в проекте: X €
Расходы по категориям: bar chart
```

**Синк → Google Sheets:**
При каждом `create`/`update`/`delete` операции — `lib/crm/sheets.ts`
пишет строку в соответствующий лист (Расходы / Доходы / Зарплаты / Инвестиции).
Формат строки: точное совпадение колонок существующей книги.

### М5. Пресметы и счета

**Пресмет (Quote):**
- Форма: клиент, позиции, IVA (21% default), срок действия, язык.
- Предпросмотр PDF.
- Отправить → email клиенту (Resend) + публичная ссылка.
- Публичная страница `/quotes/[token]`:
  - показывает пресмет на языке клиента
  - кнопка «Принять» → Quote.status = ACCEPTED → клиент двигается на стадию `WORK_SCHEDULED`
  - кнопка «Отклонить» → Quote.status = REJECTED

**Счёт (Invoice):**
- Создаётся из Quote или вручную.
- Номер генерируется атомарно (транзакция на `CompanyInfo.nextInvoiceNum`).
- Поле IRPF (по умолчанию 0%, редактируемо).
- Статусы: выставлен → частично → оплачен (при оплате создаётся FinanceEntry(INCOME)).
- PDF на выбранном языке — скачивание + отправка клиенту.
- **Disclaimer:** видный баннер «Перед использованием сверьтесь с gestором (бухгалтером)».

**PDF-шаблон (мультиязычный):**
Языки: RU / EN / ES / UK / PL.
Стиль: Navy #0A2342 + Gold #C9A84C, логотип.
Секции: реквизиты эмитента, реквизиты клиента, таблица позиций,
        база, IVA, IRPF (если > 0), итог, способ оплаты, примечания.

### М6. Аналитика

**Дашборд (главная CRM):**
- Конверсия воронки (воронка-диаграмма).
- Касса и P&L (текущий месяц + история).
- Выручка по маринам, по видам работ.
- Дебиторка (неоплаченные счета, просрочены выделены красным).
- Расходы на рекламу по каналам (FB/Google/TikTok) + стоимость лида, ROMI.
- Средний чек, кол-во работ, топ-клиенты.
- KPI-цели: план vs факт (индикатор-бар).

**Экспорт:**
- Любая таблица → CSV в формате колонок существующей книги.

### М7. Telegram-бот

**Команды:**
- `/today` — задачи на сегодня
- `/task <текст>` — добавить задачу в бэклог
- `/status <id> <статус>` — сменить статус задачи
- `/expense` — записать расход (пошаговый диалог)
- `/income` — записать доход
- `/invest` — записать доинвестицию
- `/stock` — списать/продать со склада
- `/link` — привязать Telegram к аккаунту CRM

**Фото чека:**
Пользователь присылает фото → бот загружает в Google Drive → запрашивает
подтверждение суммы/категории → создаёт FinanceEntry.

**Уведомления (push):**
- Новый лид с Facebook (если включено)
- Просрочка счёта (Cron)
- Низкий остаток склада
- Утренний дайджест задач на сегодня

---

## RBAC-матрица (начальная)

```
Модуль        VIEW  CREATE  EDIT  DELETE
CLIENTS        ✓     ✓      ✓     ✓      ← ADMIN
FUNNEL         ✓     ✓      ✓     ✓
SCHEDULE       ✓     ✓      ✓     ✓
INVENTORY      ✓     ✓      ✓     ✓
FINANCE        ✓     ✓      ✓     ✓
INVOICES       ✓     ✓      ✓     ✓
REPORTS        ✓     —      —     —
SETTINGS       ✓     ✓      ✓     ✓

EMPLOYEE — настраивается поэлементно владельцем через UI
```

---

## Переменные окружения (.env)

```env
# Существующие (не меняем)
DATABASE_URL=...
DIRECT_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
RESEND_API_KEY=...
ADMIN_EMAIL=...
OWNER_EMAIL=...

# CRM Auth (отдельный secret!)
CRM_NEXTAUTH_SECRET=...

# Google Service Account
GOOGLE_SA_CLIENT_EMAIL=...
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEETS_ID=1_nFTlprxT8imeA81awGMwpVd74l0f381eViLxDJNBjE
GOOGLE_DRIVE_RECEIPTS_FOLDER=...  # ID папки в Drive для чеков

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...  # случайная строка для верификации webhook

# OCR (Google Vision, опционально)
# GOOGLE_VISION_API_KEY=...

# Facebook (добавляется на финальном этапе через UI настроек)
# FB_APP_ID=...
# FB_PAGE_ACCESS_TOKEN=...
# FB_VERIFY_TOKEN=...
```

---

## Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/crm/cron/reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/crm/cron/sheets-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Категории расходов (справочник, seeded)

1. Лизинг / аренда авто
2. Топливо и транспорт
3. Инструмент и оборудование
4. Расходные материалы
5. Реклама — Facebook
6. Реклама — Google
7. Реклама — TikTok
8. Реклама — другое
9. Страховка
10. Связь и интернет
11. Аренда квартиры
12. Переезд
13. Прочие расходы

---

## Список марин (справочник, seeded)

Dénia · Jávea (Xàbia) · Calpe (Calp) · Altea · Benidorm · Villajoyosa ·
El Campello · Alicante · Santa Pola · Torrevieja · Guardamar · Cartagena ·
Mazarrón · Другая

---

## Требования к качеству

- Деньги: `Decimal` в Prisma + `decimal.js` в бизнес-логике. Float запрещён.
- Сервер: проверка прав перед любым действием (`lib/crm/permissions.ts`).
- Аудит: каждая мутация денег / склада / статусов → `AuditLog`.
- Секреты: только `.env`, никаких коммитов ключей.
- Транзакции: нумерация счетов — только через `prisma.$transaction`.
- Тесты: финансовые формулы + нумерация счетов + движения склада.

---

## Открытые вопросы для следующих этапов

- **Google SA credentials** — подключить на Этапе 5 (финансы).
- **Реквизиты компании** — заглушка `CompanyInfo`, заполнить через настройки CRM.
- **OCR** — Google Vision API vs. локальный Tesseract.js; решим на Этапе 5.
- **FB Lead Ads** — только на Этапе 8, после готовности токена.