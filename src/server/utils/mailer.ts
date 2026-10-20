/**
 * Truespace — Mailer Utility (`src/server/utils/mailer.ts`)
 *
 * Отправка писем через локальный Exim4 (sendmail) на сервере shved4656.fvds.ru
 * или через SMTP (если заданы переменные окружения MAIL_SMTP_*).
 */

import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransporter() {
  const smtpHost = process.env.MAIL_SMTP_HOST;
  const smtpPort = parseInt(process.env.MAIL_SMTP_PORT || '587', 10);
  const smtpUser = process.env.MAIL_SMTP_USER;
  const smtpPass = process.env.MAIL_SMTP_PASS;

  // Если SMTP-настройки заданы — используем их
  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  // Иначе — используем локальный sendmail (Exim4 на сервере)
  return nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail',
  });
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const fromAddress =
    process.env.MAIL_FROM ||
    process.env.MAIL_SMTP_USER ||
    `noreply@shved4656.fvds.ru`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Brilliant Event" <${fromAddress}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export function buildVerificationEmailHtml(code: string, fullName?: string): string {
  const name = fullName || 'пользователь';
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Подтверждение регистрации</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:32px 40px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                ✦ Brilliant Event
              </span>
              <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Финансы и маркетинг ивентов</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:16px;color:#374151;">Привет, <strong>${name}</strong>!</p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Для завершения регистрации введите код подтверждения:
              </p>
              <!-- Code box -->
              <div style="text-align:center;margin:0 0 32px;">
                <div style="display:inline-block;background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px 48px;">
                  <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#111827;font-family:'Courier New',monospace;">
                    ${code}
                  </span>
                </div>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-align:center;">
                Код действует <strong>15 минут</strong>
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#d1d5db;text-align:center;border-top:1px solid #f3f4f6;padding-top:24px;">
                Если вы не регистрировались — просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © 2026 Brilliant Event · shved4656.fvds.ru
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
