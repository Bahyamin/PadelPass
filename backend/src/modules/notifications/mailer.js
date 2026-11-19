import nodemailer from 'nodemailer';
import { config } from '../../config/index.js';

// One transport for the whole app: SMTP (Mailtrap in development) when
// SMTP_HOST is set, otherwise a "JSON" transport that sends nothing.
const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : nodemailer.createTransport({ jsonTransport: true });

// An object (not a bare function) so that tests can replace mailer.send.
export const mailer = {
  async send({ to, subject, text, html }) {
    const info = await transport.sendMail({
      from: config.mailFrom,
      to,
      subject,
      text,
      html,
    });
    if (!config.smtp.host && process.env.NODE_ENV !== 'test') {
      console.log(`[mailer] SMTP not configured, email not sent:\n${text}`);
    }
    return info;
  },
};
