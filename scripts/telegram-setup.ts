// Разовая (идемпотентная) настройка Telegram-бота: вебхук, кнопка Mini App,
// список команд. Запуск: npm run tg:setup
//
// Почему это отдельный скрипт, а не что-то, что просто "работает само": вебхук
// и menu button — состояние НА СТОРОНЕ Telegram (не в нашей базе/коде), их
// нужно явно выставить через Bot API хотя бы один раз, и переставить заново,
// если поменялся домен. Без этого бот развёрнут и код корректен, но Telegram
// просто не знает, куда слать апдейты, и кнопка "Открыть приложение" никогда
// не появится — с виду выглядит как "бот сломан".
import process from 'node:process'

try { process.loadEnvFile() } catch { /* .env отсутствует — используем переменные окружения как есть (напр. в CI) */ }

const token = process.env.TELEGRAM_BOT_TOKEN
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN не задан в .env — нечего настраивать.')
  process.exit(1)
}
if (!siteUrl || !siteUrl.startsWith('https://')) {
  console.error('NEXT_PUBLIC_SITE_URL должен быть https:// URL — Telegram требует https и для вебхука, и для Mini App.')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${token}`
const webhookUrl = `${siteUrl}/api/crm/webhook/telegram`
const miniAppUrl = `${siteUrl}/tg`

const COMMANDS = [
  { command: 'start',    description: 'Начать / привязать аккаунт' },
  { command: 'help',     description: 'Список команд' },
  { command: 'add',      description: 'Быстрая операция (меню)' },
  { command: 'today',    description: 'Задачи на сегодня' },
  { command: 'task',     description: 'Добавить задачу в бэклог' },
  { command: 'status',   description: 'Сменить статус задачи' },
  { command: 'expense',  description: 'Записать расход' },
  { command: 'income',   description: 'Записать доход' },
  { command: 'invest',   description: 'Записать доинвестицию' },
  { command: 'stock',    description: 'Списание/продажа со склада' },
  { command: 'invoices', description: 'Неоплаченные счета' },
  { command: 'pay',      description: 'Отметить счёт оплаченным' },
  { command: 'cancel',   description: 'Отменить текущий диалог' },
]

async function call(method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json()
}

async function main() {
  console.log(`Настраиваю бота на ${siteUrl}\n`)

  const wh = await call('setWebhook', {
    url: webhookUrl,
    ...(webhookSecret && { secret_token: webhookSecret }),
  })
  console.log(wh.ok ? `✓ Webhook → ${webhookUrl}` : `✗ Webhook: ${wh.description}`)

  const mb = await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Открыть приложение', web_app: { url: miniAppUrl } },
  })
  console.log(mb.ok ? `✓ Menu button → ${miniAppUrl}` : `✗ Menu button: ${mb.description}`)

  const cmds = await call('setMyCommands', { commands: COMMANDS })
  console.log(cmds.ok ? `✓ Команды: ${COMMANDS.map((c) => '/' + c.command).join(' ')}` : `✗ Команды: ${cmds.description}`)

  if (!wh.ok || !mb.ok || !cmds.ok) {
    console.error('\nЧасть настроек не применилась — см. ✗ выше.')
    process.exit(1)
  }

  console.log('\nПроверка итогового состояния:')
  const info = await call('getWebhookInfo')
  const btn = await call('getChatMenuButton')
  console.log('  getWebhookInfo:', JSON.stringify(info.result))
  console.log('  getChatMenuButton:', JSON.stringify(btn.result))
  console.log('\nГотово.')
}

main().catch((e) => { console.error('Ошибка настройки:', e); process.exit(1) })
