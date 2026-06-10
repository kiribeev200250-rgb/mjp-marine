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
  const recipients = ['kiribeev200250@gmail.com', 'mjpmarine@gmail.com'];
  const ownerEmail = process.env.OWNER_EMAIL ?? '';
  if (ownerEmail && !recipients.includes(ownerEmail)) recipients.push(ownerEmail);

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

  await Promise.allSettled([
    resend.emails.send({
      from: 'MJP Marine <noreply@mjpmarine.es>',
      to: recipients,
      subject,
      html,
    }),
    resend.emails.send({
      from: 'MJP Marine <noreply@mjpmarine.es>',
      to: recipients,
      subject: `🔴 ${data.name} ${data.phone} — новая заявка MJP`,
      text: `${data.name} ${data.phone}${data.marina ? ` · ${data.marina}` : ''}${data.service ? ` · ${data.service}` : ''}`,
    }),
  ]);
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
