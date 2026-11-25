import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import logger from './logger.js';
import { appOrigin } from './appOrigin.js';

// The icon ships with the repo, so attach it inline: mail clients block remote
// images by default. The file lives at repo-root public/, two levels above src/.
const LOGO_PATH = fileURLToPath(new URL('../../public/joblinked-icon.png', import.meta.url));
const LOGO_CID = 'joblinked-logo';

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
      // The spread lets a text-only message omit `html` instead of sending it undefined.
      ...(html ? { html } : {}),
      // A missing icon file must not block the mail: omit the attachment and
      // let the img alt text stand in.
      ...(html && existsSync(LOGO_PATH)
        ? {
            attachments: [
              { filename: 'joblinked-icon.png', path: LOGO_PATH, cid: LOGO_CID, contentDisposition: 'inline' },
            ],
          }
        : {}),
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
  const loginUrl = `${origin}/login`;
  const resetUrl = `${origin}/forgot-password`;
  const lead = 'You already have a JobLinked account — log in or reset your password.';
  const text = [
    lead,
    '',
    `Log in: ${loginUrl}`,
    `Reset your password: ${resetUrl}`,
    '',
    'If you didn’t try to register, you can ignore this email.',
  ].join('\n');
  // No greeting, no expiry claim, no sign-off: this mail only helps a person
  // who tried to register with an address that already exists.
  const html = emailLayout({
    preheader: escapeHtml(lead),
    bodyHtml: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${lead}</p>`,
      ctaButton(loginUrl, 'Log in'),
      rawLink(resetUrl, 'Reset your password'),
      noteBox('If you didn’t try to register, you can ignore this email.'),
    ].join('\n'),
    footerNote: 'You’re receiving this because someone tried to register with this email address.',
  });

  // Only a real delivery starts the cooldown, so a failed or unconfigured
  // send can be retried on the next duplicate signup.
  const sent = await deliver({ to, kind: 'existing_account', subject, text, html });
  if (sent) existingAccountSentAt.set(key, now);
};

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// The 1-hour line mirrors Better Auth's defaults for
// emailVerification.expiresIn and emailAndPassword.resetPasswordTokenExpiresIn.
// This repo sets no override; update this copy if either is ever configured.
const EXPIRY = 'This link expires in 1 hour.';

const FONT = 'font-family:Arial,Helvetica,sans-serif;';

// One table-based, inline-CSS document for every auth mail.
const emailLayout = ({ preheader, bodyHtml, footerNote }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JobLinked</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:#f1f5f9;font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4eaf1;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px 0;${FONT}">
            <img src="cid:${LOGO_CID}" width="48" height="48" alt="JobLinked" style="display:inline-block;vertical-align:middle;border-radius:12px;">
            <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:20px;font-weight:700;color:#12325b;">JobLinked</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;${FONT}">
${bodyHtml}
          </td>
        </tr>
      </table>
      <div style="max-width:600px;margin:0 auto;padding:16px 12px 0;${FONT}font-size:12px;line-height:18px;color:#64748b;text-align:center;">
        ${footerNote}<br>&copy; 2026 JobLinked
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;

const ctaButton = (url, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
  <tr>
    <td bgcolor="#2563eb" style="border-radius:8px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;

const rawLink = (url, label) => `<p style="margin:0 0 16px;font-size:12px;line-height:18px;color:#64748b;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#2563eb;">${escapeHtml(label || url)}</a></p>`;

const noteBox = (html) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
  <tr>
    <td bgcolor="#edf4ff" style="background-color:#edf4ff;border-radius:8px;padding:12px 16px;font-size:13px;line-height:20px;color:#12325b;">${html}</td>
  </tr>
</table>`;

// User data: collapse whitespace so a name cannot inject extra lines into the
// text part; the html part escapes it separately.
const displayName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim() || 'there';

// Both auth mails share one body shape: greeting, purpose, CTA, raw link,
// expiry note, sign-off. The URL is Better Auth's and trusted; the name is
// user data, so the html part escapes it. Text stays the fallback part.
const authEmail = ({ user, url, purpose, cta, note, footerNote }) => {
  const name = displayName(user?.name);
  return {
    text: [`Hi ${name},`, '', purpose, '', url, '', `${EXPIRY} ${note}`, '', '— The JobLinked team'].join('\n'),
    html: emailLayout({
      preheader: escapeHtml(purpose),
      bodyHtml: [
        `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#12325b;">Hi ${escapeHtml(name)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${purpose}</p>`,
        ctaButton(url, cta),
        rawLink(url),
        noteBox(`${EXPIRY}<br>${note}`),
        '<p style="margin:0;font-size:15px;line-height:24px;color:#334155;">— The JobLinked team</p>',
      ].join('\n'),
      footerNote,
    }),
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
      footerNote: 'You’re receiving this because a password reset was requested for your JobLinked account.',
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
      footerNote: 'You’re receiving this because you signed up for JobLinked.',
    }),
  });
