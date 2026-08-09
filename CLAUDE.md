# MJP Marine CRM — рабочие правила для Claude Code

## Секреты и безопасность
- Секреты — в `.env`, ключи Google/FB/Telegram не коммитить.
- Проверка прав — на сервере, всегда; UI лишь прячет недоступное.
- Все мутации денег/склада/статусов → аудит-лог.
- Деньги — только через безопасную арифметику (целые центы / Decimal), никаких float.

## Стек
- Next.js App Router (15+); route params — `Promise<{id}>`, awaitable.
- Prisma + Supabase Postgres; деньги — `@db.Decimal(12,2)`.
- Tailwind: токены из `tailwind.config.ts` — navy/gold/success/danger/info/warning/gray.
- Шрифт CRM — Inter через CSS-переменную `--font-inter`; сайт — Mulish, не трогать.

## Design reference
- Эталон визуала всех экранов CRM — папка `design/` в корне репозитория.
- Перед вёрсткой/правкой любого экрана CRM обязательно открыть соответствующие
  файлы из `design/` и верстать строго по ним.
- Имя файла = экран: `dashboard`, `clients`, `pipeline`, `planner`, `warehouse`,
  `finance`, `invoice`, `access`, `styleguide`, `login`, `setup`.
- Один экран может быть разбит на несколько файлов:
  - Суффиксы `-top` / `-bottom` (или `-1` / `-2`) — длинный экран по вертикали:
    собрать верх и низ в **одну** страницу, не делать два разных экрана.
  - Суффиксы `-week` / `-month` / `-day`, `-list` / `-detail`, `-empty` / `-filled` —
    разные виды/состояния одного экрана: реализовать все как переключатели/состояния
    внутри одного экрана.
- Данные — из Prisma/Supabase, **не** из моковых. Дизайн задаёт вид, база — данные.

### Порядок работы с design/
1. В начале работы над экраном: `ls design/`, найти все файлы экрана.
2. Открыть каждый файл через Read и проанализировать.
3. Если несколько файлов `*-top/*-bottom` — собрать в один экран.
4. Если несколько видов `*-week/*-month` — реализовать как переключатели.
5. Верстать строго на токенах/компонентах фундамента (Button/Badge/Input/Select/
   Card/KpiCard/SectionHeader/DataTable + CrmSidebar/CrmTopbar).
   Никаких сырых hex/px по экранам.

### Приёмка экрана
- Совпадает с референсами из `design/`.
- Собран на общих компонентах.
- Данные из реальной базы (или явные заглушки, если бэкенд не готов).
- Интерфейс русский; деньги EUR, минус красным, `tabular-nums`.
- Focus виден с клавиатуры.
- Публичный сайт по-прежнему собирается (`npx tsc --noEmit` без ошибок).

### Текущие файлы в design/ (актуализировать при добавлении новых)
| Файл                  | Экран              | Вид/часть    |
|-----------------------|--------------------|--------------|
| dashboard.png         | Dashboard          | полный       |
| clients.png           | Clients            | list+detail  |
| pipeline.png          | Sales Pipeline     | верх         |
| pipeline-bottom.png   | Sales Pipeline     | низ          |
| planner-week.png      | Planner            | неделя       |
| planner-month.png     | Planner            | месяц        |
| planner-day.png       | Planner            | день         |
| warehouse.png         | Warehouse          | полный       |
| finance.png           | Finance            | полный       |
| invoice.png           | Invoice            | полный       |
| access.png            | Access/Settings    | полный       |
| styleguide-top.png    | Style Guide        | верх         |
| styleguide-bottom.png | Style Guide        | низ          |
| YANMAR.pdf            | Presupuesto/Factura (реф.) | формат таблицы работа→материалы, из Náutica Martínez |

> ⚠ login.png / setup.png в `design/` отсутствуют.
> Если появятся — добавить в таблицу и перевёрстать экран по ним.

## Правила дизайн-системы
- Shell (sidebar + topbar): `bg-navy-900` — всегда тёмный.
- Content area: `bg-gray-50` — всегда светлый.
- Карточки: `bg-white rounded-card shadow-e2 border border-gray-200/60`.
- Кнопки: только `<Button>` из `components/crm/ui`.
- Бейджи: только `<Badge tone="...">` из `components/crm/ui`.
- Деньги: `formatMoney()` из `lib/crm/utils.ts` + `tabular-nums` + `text-danger` при < 0.

## Стадии воронки (Pipeline)
`Новый лид → Контакт → Пресмет → Запланировано → Выполнено → Счёт → Оплачено`
Prisma-значения: `NEW_LEAD | CONTACT_MADE | QUOTE_SENT | WORK_SCHEDULED | WORK_DONE | INVOICE_SENT | PAID`

## Этапы реализации
- ✅ Этап 0: ARCHITECTURE.md + SPEC.md
- ✅ Этап 1: Auth + RBAC + UI shell
- ✅ Этап 2: Клиенты + воронка
- ✅ Этап 3: Планировщик (неделя/месяц/день + backlog + DnD)
- ✅ Этап 4: Склад (warehouse)
- ✅ Этап 5: Финансы (без Google Sheets sync — не подключено)
- ✅ Этап 6: Счета/пресметы (IVA, IRPF, PDF на 5 языках, публичная ссылка, email)
- ✅ Этап 7: Telegram-бот (grammY) — команды, диалоги, фото-чек (заглушка), cron-дайджест
- ✅ Этап 8: Аналитика (`/crm/reports`), CSV-экспорт, FB Lead Ads (заглушка, выключено по умолчанию)

### Пост-аудит: Планировщик — материалы + фото (после Этапа 8)
- Задача (`Task`) получила `plannedMaterials Json` (снапшот `{itemId,name,unit,qty}[]`)
  и `materialsWrittenOff Boolean`. UI — `MaterialsSection` на странице задачи:
  поиск по складу → qty → «Добавить», список редактируем ТОЛЬКО пока не списано.
- Автосписание (SPEC М2): при PATCH `status → DONE`, если есть непустой
  `plannedMaterials` и `materialsWrittenOff === false` — `app/api/crm/tasks/[id]/route.ts`
  создаёт `StockMovement(WRITE_OFF)` на каждый материал, уменьшает
  `qtyInStock`, шлёт Telegram-алерт при уходе ниже минимума, ставит
  `materialsWrittenOff: true`. Проверено вживую: списание 2→1 шт подтверждено на складе.
- Фото до/после — `lib/crm/storage.ts` (Supabase Storage, бакет `task-photos`,
  ленивая инициализация как у Telegram-бота) + `app/api/crm/tasks/[id]/photos/route.ts`
  (POST загрузка, DELETE удаление) + `PhotosSection` UI. **Проверено вживую**
  (2026-08-09): загрузка → публичный URL рендерится → удаление, полный цикл
  подтверждён с реальным бакетом. Ключ — новый формат `sb_secret_...` (не
  `service_role` JWT), `supabase-js` v2.112 принимает оба формата одинаково.
  Без ключей/бакета роут отвечает понятной ошибкой (503 / "Bucket not found"),
  не падает молча.

### Заметка по Этапу 8
- `/crm/reports` — выручка по маринам/видам работ (виды работ = категории
  `FinanceEntry(INCOME)`, отдельного поля «тип работы» в схеме нет), реклама по
  каналам + блендед CPL/ROMI (точная привязка канал→лид есть только для
  Facebook через `ClientSource`), топ-клиенты, дебиторка с просрочкой красным,
  KPI-цель план/факт (`KpiGoal`, редактируется прямо на странице).
- CSV-экспорт (`lib/crm/csv.ts` + `<ExportCsvButton>`): **headers/rows должны
  быть готовыми плоскими массивами (string|number), посчитанными на сервере**.
  Функции нельзя передавать из Server Component в Client Component («Functions
  cannot be passed directly to Client Components») — именно поэтому
  `ExportCsvButton` принимает `headers: string[]` + `rows: (string|number)[][]`,
  а не колонки с функциями-аксессорами. Не возвращать это оформление.
- FB Lead Ads — заготовка: настройки в CRM → Настройки → Facebook Lead Ads
  (App ID / Verify Token / Page Access Token, выключено по умолчанию), webhook
  `/api/crm/webhook/facebook` (GET — верификация, POST — принимает
  `leadgen_id` и дозапрашивает данные лида через Graph API с Page Access
  Token). Проверено вживую: verify handshake и graceful-ошибка на
  невалидном токене работают; создание клиента из реального лида не
  тестировалось — нет настоящего FB App/токена.
- Инпуты рядом с `type="password"` — ставить `autoComplete="off"` (соседним
  текстовым полям) и `autoComplete="new-password"` (самому паролю), иначе
  Chrome подставляет туда сохранённый email/логин пользователя (нашли на
  форме FB Lead Ads: поле App ID автозаполнялось email'ом админа).

### Заметка по Этапу 7 (важно для будущих правок бота)
- Сессии grammY (в т.ч. `@grammyjs/conversations`) хранятся в Postgres
  (`TelegramSession` + `lib/crm/telegram/session-storage.ts`) — серверлесс-инвокейшены
  не делят память между сообщениями одного диалога, in-memory session не переживёт продакшен.
- `conversation.external(...)` клонирует возвращаемое значение через `structuredClone`
  для журнала повторов. **Никогда не возвращать из него сырые Prisma-записи или
  Decimal** — оба не клонируются (`DataCloneError`). Возвращать только примитивы
  (строки/числа/булевы), конвертируя Decimal через `.toString()` заранее.
  См. `lib/crm/telegram/conversations.ts`.
- Привязка аккаунта: код генерируется в CRM → Настройки → Пользователи CRM
  (кнопка «Получить код», 15 минут), сотрудник отправляет боту `/link <код>`.
- Фото чека сохраняется как временная ссылка на Telegram CDN (`receiptUrl`), НЕ в
  Google Drive — SA credentials всё ещё не подключены (см. Этап 5). Когда появятся,
  перенести загрузку чеков туда же, где будет реализован Sheets sync.
- Локальный dev-тест бота без публичного webhook URL: см. `scripts/tg-relay.sh`-стиль
  скрипт — long-poll `getUpdates` и форвард апдейтов на `POST /api/crm/webhook/telegram`
  на localhost. Реальная отправка ответов через `bot.api.sendMessage` работает
  независимо от способа получения апдейтов.

### Модуль «Сметы и Счета» — иерархия работа→материалы (после Mini App, 2026-08-09)
Развитие Этапа 6: `QuoteItem`/`InvoiceItem` (плоские позиции) **заменены полностью**
на `QuoteJob`→`QuoteMaterial` и `InvoiceJob`→`InvoiceMaterial` (родитель-работа,
дети-материалы, нумерация 1/1.1/1.2 в UI и PDF). Старые плоские модели удалены из
схемы — 2 тестовых пресмета и 1 счёт со старой структурой были снесены при
`prisma db push --accept-data-loss` (осознанное решение пользователя, детализация
осталась только в уже сгенерированных PDF).
- Общий парсинг/сборка работ — `lib/crm/documentJobs.ts` (`parseJobsInput`,
  `jobsToCreateInput`), используется и в `/api/crm/quotes`, и в `/api/crm/invoices`
  (POST), чтобы Decimal-логика (материал: qty×price; работа: сумма материалов +
  ручной `laborCost`; jobsTotal/materialsTotal/subtotal/IVA/IRPF/total) не
  дублировалась и не расходилась между документами.
- `Quote`/`Invoice` получили снапшот-поля `jobsTotal`/`materialsTotal` в дополнение
  к существующему `subtotal` (= их сумма) — PDF и все detail-страницы показывают
  «Итого работа» / «Итого материалы» отдельно, это и было целью фичи (клиент видел
  общую сумму «Материалы», не видел из чего складывается — теперь видит).
- Материал может ссылаться на `InventoryItem` (`inventoryItemId`, автокомплит в
  конструкторе подтягивает `sellPrice`) ИЛИ быть чисто ручным — оба пути не
  списывают склад при создании документа (это план, не движение; списание —
  через задачу планировщика, см. заметку по материалам задач выше).
- PDF (`lib/crm/pdf.tsx`): `Image` из `@react-pdf/renderer` рендерит
  `companyInfo.logoUrl` в шапке, если он задан в настройках — без логотипа шапка
  просто без лого, не ломается. Строка подписи «Client signature»/«Conforme el
  cliente» и т.п. — только для пресметов (`kind: 'quote'`), у счетов вместо неё
  дисклеймер про gestor'а, как было.
- Живой предпросмотр конструктора (`DocumentBuilder.tsx`) пересчитывает всё на
  клиенте через `decimal.js` идентично серверной логике — сервер всё равно
  пересчитывает и сохраняет как источник истины (клиентский расчёт только для UX).
- Протестировано вживую end-to-end: создание пресмета (работа + материал со
  склада + материал вручную) → детальная страница → PDF → публичная ссылка
  клиента (полная детализация видна) → принятие клиентом → «Создать счёт из
  пресмета» → счёт наследует всю иерархию один в один. Все суммы сошлись.

### Заметка по Этапу 6 (важно для будущих правок PDF/email-роутов)
`@react-pdf/renderer` ломается с `React error #31`, если модуль, использующий его
JSX (`lib/crm/pdf.tsx`), импортируется из `app/api/**/route.ts`. Причина: Next
резолвит `react`/`react/jsx-runtime` под условием `react-server` для всего графа
`app/`, а react-pdf ожидает полный клиентский React. Поэтому PDF- и email-роуты
(`.../pdf`, `.../send` для quotes и invoices) живут в `pages/api/crm/...`
(Pages Router), а не в `app/api/crm/...`. Не переносить их обратно в `app/api`
без повторной проверки. Шрифт Roboto (кириллица + латиница с диакритикой)
зашит в `public/fonts/` — не заменять на fetch с Google Fonts на рантайме.