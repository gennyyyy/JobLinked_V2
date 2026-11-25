import nodemailer from 'nodemailer';
import logger from './logger.js';
import { appOrigin } from './appOrigin.js';

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

const deliver = async ({ to, url, kind, subject, text, html }) => {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: the operator sees the outage, and the token stays out of
      // the logs. Never pretend the mail was sent.
      logger.error('mail_not_configured', { event: 'mail_not_configured', to, kind });
      return false;
    }
    // Dev has no sender: the URL (with its token) is the only log that carries
    // it. A multi-link message logs its body instead. Neither runs in production.
    logger.info('dev_mail', {
      event: 'dev_mail',
      to,
      kind,
      ...(url ? { url } : {}),
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });
    return true;
  }

  // Log status only. Catching here (both sync transport setup and async send)
  // keeps an SMTP failure from becoming a 500 on sign-up/reset; BA awaits
  // whatever the callback returns. The boolean lets callers tell delivery from
  // a swallowed failure (the existing-account cooldown only starts on success).
  try {
    await transportFor().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text: text ?? `${subject}\n\n${url}`,
      // Mails without an html part (the existing-account one) omit it entirely.
      ...(html ? { html } : {}),
    });
    logger.info('mail_sent', { event: 'mail_sent', to, kind });
    return true;
  } catch (error) {
    logger.error('mail_failed', {
      event: 'mail_failed',
      to,
      kind,
      code: error?.code,
      // SMTP rejections (e.g. 550 domain refused) live on these fields, not in
      // `code`; without them the failure is invisible. Never log `error` itself.
      responseCode: error?.responseCode,
      command: error?.command,
      response: error?.response == null ? undefined : String(error.response).slice(0, 200),
    });
    return false;
  }
};

// ponytail: per-process, unbounded-ish in-memory cooldown. One duplicate
// signup per instance still mails in a multi-instance API; move to Redis/DB
// (or rely on BA's rate limiter) if that matters.
const EXISTING_ACCOUNT_COOLDOWN_MS = 10 * 60 * 1000;
const existingAccountSentAt = new Map();

export const sendExistingAccountEmail = async ({ user }) => {
  const to = user?.email;
  if (!to) return;
  const key = to.toLowerCase();
  const now = Date.now();
  const last = existingAccountSentAt.get(key);
  if (last && now - last < EXISTING_ACCOUNT_COOLDOWN_MS) return;
  // Sweep only once the map is big enough to be worth it; each entry needs a
  // duplicate signup for an existing address, so this stays small in practice.
  if (existingAccountSentAt.size > 5000) {
    for (const [address, sentAt] of existingAccountSentAt) {
      if (now - sentAt >= EXISTING_ACCOUNT_COOLDOWN_MS) existingAccountSentAt.delete(address);
    }
  }

  const origin = appOrigin();
  const subject = 'You already have a JobLinked account';
  const text = [
    'You already have a JobLinked account — log in or reset your password.',
    '',
    `Log in: ${origin}/login`,
    `Reset your password: ${origin}/forgot-password`,
    '',
    'If you didn’t try to register, you can ignore this email.',
  ].join('\n');

  // Only a real delivery starts the cooldown, so a failed or unconfigured
  // send can be retried on the next duplicate signup.
  const sent = await deliver({ to, kind: 'existing_account', subject, text });
  if (sent) existingAccountSentAt.set(key, now);
};

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// The 1-hour line mirrors Better Auth's defaults for
// emailVerification.expiresIn and emailAndPassword.resetPasswordTokenExpiresIn.
// This repo sets no override; update this copy if either is ever configured.
const EXPIRY = 'This link expires in 1 hour.';

// Both auth mails share one body shape: greeting, purpose, URL, expiry note,
// sign-off. The URL is Better Auth's and trusted; the name is user data, so the
// html part escapes it. Text stays the fallback part.
const authEmail = ({ user, url, purpose, cta, note }) => {
  const name = user?.name?.trim() || 'there';
  const expiry = `${EXPIRY} ${note}`;
  return {
    text: [`Hi ${name},`, '', purpose, '', url, '', expiry, '', '— The JobLinked team'].join('\n'),
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      `<p>${purpose}</p>`,
      `<p><a href="${url}">${cta}</a></p>`,
      `<p>${expiry}</p>`,
      '<p>— The JobLinked team</p>',
    ].join('\n'),
  };
};

export const sendResetPassword = ({ user, url }) =>
  deliver({
    to: user.email,
    url,
    kind: 'reset_password',
    subject: 'Reset your JobLinked password',
    ...authEmail({
      user,
      url,
      purpose:
        'We received a request to reset the password for your JobLinked account. Open the link below to choose a new password.',
      cta: 'Reset my password',
      note: "If you didn't request this, you can ignore this email — your password will stay the same.",
    }),
  });

export const sendVerificationEmail = ({ user, url }) =>
  deliver({
    to: user.email,
    url,
    kind: 'verify_email',
    subject: 'Verify your JobLinked email',
    ...authEmail({
      user,
      url,
      purpose: 'Welcome to JobLinked! Please confirm your email address by opening the link below.',
      cta: 'Verify my email',
      note: "If you didn't create a JobLinked account, you can ignore this email.",
    }),
  });
