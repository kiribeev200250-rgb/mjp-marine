import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(data: {
  name: string;
  phone: string;
  email?: string;
  marina?: string;
  boatType?: string;
  service?: string;
  message?: string;
}) {
  const ownerEmail = process.env.OWNER_EMAIL ?? '';
  if (!ownerEmail) return;

  await resend.emails.send({
    from: 'MJP Marine <noreply@mjpmarine.es>',
    to: ownerEmail,
    subject: `New service request from ${data.name}`,
    html: `
      <h2>New Service Request</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Phone:</strong> ${data.phone}</p>
      ${data.email ? `<p><strong>Email:</strong> ${data.email}</p>` : ''}
      ${data.marina ? `<p><strong>Marina:</strong> ${data.marina}</p>` : ''}
      ${data.boatType ? `<p><strong>Boat type:</strong> ${data.boatType}</p>` : ''}
      ${data.service ? `<p><strong>Service needed:</strong> ${data.service}</p>` : ''}
      ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
    `,
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
