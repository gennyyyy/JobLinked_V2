import nodemailer from 'nodemailer';
import logger from './logger.js';

// One transport, built on first real send. Dev and misconfigured-production
// paths never create it, so importing this module has no side effects.
let transport;
const transportFor = () =>
  (transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  }));

const deliver = async ({ to, url, kind, subject }) => {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: the operator sees the outage, and the token stays out of
      // the logs. Never pretend the mail was sent.
      logger.error('mail_not_configured', { event: 'mail_not_configured', to, kind });
      return;
    }
    // Dev has no sender: the URL (with its token) is the only log that carries
    // it. This branch must never run in production.
    logger.info('dev_mail', { event: 'dev_mail', to, url });
    return;
  }

  // Log status only. Catching here (both sync transport setup and async send)
  // keeps an SMTP failure from becoming a 500 on sign-up/reset; BA awaits
  // whatever the callback returns.
  try {
    await transportFor().sendMail({ from: process.env.SMTP_FROM, to, subject, text: `${subject}\n\n${url}` });
    logger.info('mail_sent', { event: 'mail_sent', to, kind });
  } catch (error) {
    logger.error('mail_failed', { event: 'mail_failed', to, kind, code: error?.code });
  }
};

export const sendResetPassword = ({ user, url }) =>
  deliver({ to: user.email, url, kind: 'reset_password', subject: 'Reset your JobLinked password' });

export const sendVerificationEmail = ({ user, url }) =>
  deliver({ to: user.email, url, kind: 'verify_email', subject: 'Verify your JobLinked email' });
