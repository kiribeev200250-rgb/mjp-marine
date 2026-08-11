import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

function esc(s?: string) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendContactEmail(data: {
  name: string;
  phone: string;
  email?: string;
  marina?: string;
  boatType?: string;
  service?: string;
  message?: string;
}) {
  const recipients = ['kiribeev200250@gmail.com', 'mjpmarine1@gmail.com'];

  const madridTime = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Madrid',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const waNumber = data.phone.replace(/\D/g, '');
  const subject = `🚨 НОВАЯ ЗАЯВКА — MJP Marine Service — ${data.name}${data.marina ? ` — ${data.marina}` : ''}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <tr><td style="background:linear-gradient(135deg,#c0392b,#e67e22);padding:28px 32px;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:1px;">🚨 НОВАЯ ЗАЯВКА С САЙТА</p>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">mjpmarine.com · ${esc(madridTime)} (Madrid)</p>
      </td></tr>

      <tr><td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-left:5px solid #2e7d32;border-radius:4px;padding:20px 24px;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Имя</p>
            <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">${esc(data.name)}</p>
            <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Телефон / WhatsApp</p>
            <p style="margin:0 0 ${data.email ? '16px' : '0'};font-size:20px;font-weight:700;"><a href="tel:${esc(data.phone)}" style="color:#1b5e20;text-decoration:none;">${esc(data.phone)}</a></p>
            ${data.email ? `<p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Email</p><p style="margin:0;font-size:16px;"><a href="mailto:${esc(data.email)}" style="color:#1b5e20;">${esc(data.email)}</a></p>` : ''}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${data.marina ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#888;width:140px;">Марина</td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:15px;color:#1a1a1a;font-weight:600;">${esc(data.marina)}</td></tr>` : ''}
          ${data.boatType ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#888;">Тип лодки</td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:15px;color:#1a1a1a;font-weight:600;">${esc(data.boatType)}</td></tr>` : ''}
          ${data.service ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#888;">Услуга</td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:15px;color:#1a1a1a;font-weight:600;">${esc(data.service)}</td></tr>` : ''}
          ${data.message ? `<tr><td style="padding:10px 0;font-size:13px;color:#888;vertical-align:top;">Сообщение</td><td style="padding:10px 0;font-size:15px;color:#1a1a1a;">${esc(data.message)}</td></tr>` : ''}
        </table>
      </td></tr>

      <tr><td style="padding:28px 32px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;">
            <a href="tel:${esc(data.phone)}" style="display:inline-block;padding:14px 28px;background:#c0392b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:6px;">📞 Позвонить</a>
          </td>
          <td>
            <a href="https://wa.me/${waNumber}" style="display:inline-block;padding:14px 28px;background:#25d366;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:6px;">💬 WhatsApp</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:16px 32px;background:#f8f8f8;border-top:1px solid #eeeeee;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;">Заявка получена ${esc(madridTime)} · mjpmarine.com</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  console.log('Sending email to kiribeev200250@gmail.com and mjpmarine1@gmail.com');

  const [htmlResult, textResult] = await Promise.allSettled([
    resend.emails.send({
      from: 'onboarding@resend.dev',
      to: recipients,
      subject,
      html,
    }),
    resend.emails.send({
      from: 'onboarding@resend.dev',
      to: recipients,
      subject: `🔴 ${data.name} ${data.phone} — новая заявка MJP`,
      text: `${data.name} ${data.phone}${data.marina ? ` · ${data.marina}` : ''}${data.service ? ` · ${data.service}` : ''}`,
    }),
  ]);

  console.log('Resend HTML result:', JSON.stringify(htmlResult));
  console.log('Resend text result:', JSON.stringify(textResult));
}

// ─── CRM: пресметы и счета ──────────────────────────────────────────────────

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const CRM_SUBJECTS: Record<'quote' | 'invoice', Record<string, (n: string) => string>> = {
  quote: {
    ru: (n) => `Пресмет ${n} — MJP Marine Service`,
    en: (n) => `Quote ${n} — MJP Marine Service`,
    es: (n) => `Presupuesto ${n} — MJP Marine Service`,
    uk: (n) => `Кошторис ${n} — MJP Marine Service`,
    pl: (n) => `Wycena ${n} — MJP Marine Service`,
  },
  invoice: {
    ru: (n) => `Счёт ${n} — MJP Marine Service`,
    en: (n) => `Invoice ${n} — MJP Marine Service`,
    es: (n) => `Factura ${n} — MJP Marine Service`,
    uk: (n) => `Рахунок ${n} — MJP Marine Service`,
    pl: (n) => `Faktura ${n} — MJP Marine Service`,
  },
};

const CRM_BODIES: Record<'quote' | 'invoice', Record<string, (name: string, total: string, link?: string) => string>> = {
  quote: {
    ru: (name, total, link) => `<p>Здравствуйте, ${esc(name)}!</p><p>Прикладываем пресмет на сумму <b>${total}</b>.</p>${link ? `<p><a href="${link}" style="color:#C9A84C;">Посмотреть и принять пресмет онлайн →</a></p>` : ''}<p>— MJP Marine Service</p>`,
    en: (name, total, link) => `<p>Hello ${esc(name)},</p><p>Please find attached your quote for <b>${total}</b>.</p>${link ? `<p><a href="${link}" style="color:#C9A84C;">View and accept the quote online →</a></p>` : ''}<p>— MJP Marine Service</p>`,
    es: (name, total, link) => `<p>Hola ${esc(name)},</p><p>Adjuntamos su presupuesto por <b>${total}</b>.</p>${link ? `<p><a href="${link}" style="color:#C9A84C;">Ver y aceptar el presupuesto online →</a></p>` : ''}<p>— MJP Marine Service</p>`,
    uk: (name, total, link) => `<p>Вітаємо, ${esc(name)}!</p><p>Додаємо кошторис на суму <b>${total}</b>.</p>${link ? `<p><a href="${link}" style="color:#C9A84C;">Переглянути та прийняти кошторис онлайн →</a></p>` : ''}<p>— MJP Marine Service</p>`,
    pl: (name, total, link) => `<p>Witaj, ${esc(name)}!</p><p>W załączniku przesyłamy wycenę na kwotę <b>${total}</b>.</p>${link ? `<p><a href="${link}" style="color:#C9A84C;">Zobacz i zaakceptuj wycenę online →</a></p>` : ''}<p>— MJP Marine Service</p>`,
  },
  invoice: {
    ru: (name, total) => `<p>Здравствуйте, ${esc(name)}!</p><p>Прикладываем счёт на сумму <b>${total}</b>.</p><p>— MJP Marine Service</p>`,
    en: (name, total) => `<p>Hello ${esc(name)},</p><p>Please find attached your invoice for <b>${total}</b>.</p><p>— MJP Marine Service</p>`,
    es: (name, total) => `<p>Hola ${esc(name)},</p><p>Adjuntamos su factura por <b>${total}</b>.</p><p>— MJP Marine Service</p>`,
    uk: (name, total) => `<p>Вітаємо, ${esc(name)}!</p><p>Додаємо рахунок на суму <b>${total}</b>.</p><p>— MJP Marine Service</p>`,
    pl: (name, total) => `<p>Witaj, ${esc(name)}!</p><p>W załączniku przesyłamy fakturę na kwotę <b>${total}</b>.</p><p>— MJP Marine Service</p>`,
  },
};

export async function sendDocumentEmail(params: {
  kind: 'quote' | 'invoice';
  to: string;
  clientName: string;
  number: string;
  totalFormatted: string;
  language: string;
  pdfStream: NodeJS.ReadableStream;
  publicLink?: string;
}) {
  const lang = ['ru', 'en', 'es', 'uk', 'pl'].includes(params.language) ? params.language : 'ru';
  const subject = (CRM_SUBJECTS[params.kind][lang] ?? CRM_SUBJECTS[params.kind].ru)(params.number);
  const html = (CRM_BODIES[params.kind][lang] ?? CRM_BODIES[params.kind].ru)(params.clientName, params.totalFormatted, params.publicLink);
  const pdfBuffer = await streamToBuffer(params.pdfStream);

  return resend.emails.send({
    from: 'MJP Marine <noreply@mjpmarine.es>',
    to: params.to,
    subject,
    html,
    attachments: [
      {
        filename: `${params.number}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

export async function sendWelcomeEmail(to: string, name: string, lang: string) {
  const subjects: Record<string, string> = {
    en: 'Welcome to MJP Marine Service updates!',
    es: '¡Bienvenido a las novedades de MJP Marine Service!',
    ru: 'Добро пожаловать в рассылку MJP Marine Service!',
    uk: 'Ласкаво просимо до розсилки MJP Marine Service!',
  };
  const bodies: Record<string, string> = {
    en: `<p>Hi ${name},</p><p>Thanks for subscribing! You'll receive seasonal tips and maintenance reminders for your boat.</p><p>— MJP Marine Service team</p>`,
    es: `<p>Hola ${name},</p><p>¡Gracias por suscribirte! Recibirás consejos de temporada y recordatorios de mantenimiento.</p><p>— Equipo MJP Marine Service</p>`,
    ru: `<p>Привет, ${name}!</p><p>Спасибо за подписку! Вы будете получать сезонные советы и напоминания об обслуживании.</p><p>— Команда MJP Marine Service</p>`,
    uk: `<p>Привіт, ${name}!</p><p>Дякуємо за підписку! Ви отримуватимете сезонні поради та нагадування про обслуговування.</p><p>— Команда MJP Marine Service</p>`,
  };

  await resend.emails.send({
    from: 'MJP Marine <noreply@mjpmarine.es>',
    to,
    subject: subjects[lang] ?? subjects.en,
    html: bodies[lang] ?? bodies.en,
  });
}

// Вежливое напоминание клиенту о просроченном счёте — из cron
// (app/api/crm/cron/reminders/route.ts). БЕЗ вложения PDF: рендер PDF
// использует react-pdf JSX, который ломается при импорте из app/api/**
// (см. заметку по Этапу 6 в CLAUDE.md) — этот cron живёт в App Router, а не
// в Pages Router, куда вынесены остальные PDF-роуты. Без публичной ссылки на
// счёт — у Invoice (в отличие от Quote) нет publicToken/токена вообще.
const OVERDUE_SUBJECTS: Record<string, (n: string) => string> = {
  ru: (n) => `Напоминание об оплате — счёт ${n} — MJP Marine Service`,
  en: (n) => `Payment reminder — invoice ${n} — MJP Marine Service`,
  es: (n) => `Recordatorio de pago — factura ${n} — MJP Marine Service`,
  uk: (n) => `Нагадування про оплату — рахунок ${n} — MJP Marine Service`,
  pl: (n) => `Przypomnienie o płatności — faktura ${n} — MJP Marine Service`,
};

const OVERDUE_BODIES: Record<string, (name: string, number: string, total: string, dueDate: string) => string> = {
  ru: (name, number, total, dueDate) =>
    `<p>Здравствуйте, ${esc(name)}!</p><p>Напоминаем о неоплаченном счёте <b>${esc(number)}</b> на сумму <b>${esc(total)}</b> — срок оплаты был ${esc(dueDate)}.</p><p>Пожалуйста, свяжитесь с нами, если возникли вопросы по оплате.</p><p>— MJP Marine Service</p>`,
  en: (name, number, total, dueDate) =>
    `<p>Hello ${esc(name)},</p><p>This is a reminder that invoice <b>${esc(number)}</b> for <b>${esc(total)}</b> was due on ${esc(dueDate)} and remains unpaid.</p><p>Please get in touch if you have any questions about payment.</p><p>— MJP Marine Service</p>`,
  es: (name, number, total, dueDate) =>
    `<p>Hola ${esc(name)},</p><p>Le recordamos que la factura <b>${esc(number)}</b> por <b>${esc(total)}</b> venció el ${esc(dueDate)} y sigue pendiente de pago.</p><p>Contáctenos si tiene alguna duda sobre el pago.</p><p>— MJP Marine Service</p>`,
  uk: (name, number, total, dueDate) =>
    `<p>Вітаємо, ${esc(name)}!</p><p>Нагадуємо про неоплачений рахунок <b>${esc(number)}</b> на суму <b>${esc(total)}</b> — термін оплати був ${esc(dueDate)}.</p><p>Будь ласка, зв'яжіться з нами, якщо виникли питання щодо оплати.</p><p>— MJP Marine Service</p>`,
  pl: (name, number, total, dueDate) =>
    `<p>Witaj, ${esc(name)}!</p><p>Przypominamy o nieopłaconej fakturze <b>${esc(number)}</b> na kwotę <b>${esc(total)}</b> — termin płatności upłynął ${esc(dueDate)}.</p><p>Prosimy o kontakt w razie pytań dotyczących płatności.</p><p>— MJP Marine Service</p>`,
};

export async function sendOverdueInvoiceEmail(params: {
  to: string; clientName: string; number: string; totalFormatted: string; dueDateFormatted: string; language: string;
}) {
  const lang = ['ru', 'en', 'es', 'uk', 'pl'].includes(params.language) ? params.language : 'ru';
  const subject = (OVERDUE_SUBJECTS[lang] ?? OVERDUE_SUBJECTS.ru)(params.number);
  const html = (OVERDUE_BODIES[lang] ?? OVERDUE_BODIES.ru)(params.clientName, params.number, params.totalFormatted, params.dueDateFormatted);

  return resend.emails.send({
    from: 'MJP Marine <noreply@mjpmarine.es>',
    to: params.to,
    subject,
    html,
  });
}
