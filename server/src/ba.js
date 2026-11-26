import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import bcrypt from 'bcrypt';
import { admin, captcha, twoFactor } from 'better-auth/plugins';
import { sendExistingAccountEmail, sendResetPassword, sendVerificationEmail } from './mailer.js';
import { passwordPolicyError } from './passwordPolicy.js';
import { canRequestReset, recordResetRequest } from './requestResetCooldown.js';
import logger from './logger.js';

// The only place betterAuth() is configured. Later tasks import { auth }.
const trustedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// BA rejects credential POSTs whose Origin is untrusted, so local dev needs
// these even when CORS_ORIGIN points at a deployed origin. Wildcards (BA's
// supported trustedOrigins pattern) cover the same set as app.js's dev CORS
// regex: any localhost port, so Vite's 5174/5175 fallback and the 4173 preview
// cannot silently lock a developer out.
if (process.env.NODE_ENV !== 'production') {
  trustedOrigins.push('http://localhost:*', 'http://127.0.0.1:*');
}

// Emailed links and cookie hosts derive from baseURL. Unset in dev it warns on
// every boot; fall back to the documented local API port. Production keeps BA's
// own behaviour (no silent default) — Task 12 makes the value mandatory.
const baseURL = process.env.BETTER_AUTH_URL
  || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : undefined);

// ADR-056 decision 6: the captcha plugin is registered only when its secret is
// configured. An always-registered plugin with no secret fails every sign-in,
// sign-up, and reset with MISSING_RESPONSE; a dev-only bypass is the lesser
// evil. Production still requires the secret at cutover (Task 12).
const plugins = [admin(), twoFactor()];
if (process.env.TURNSTILE_SECRET_KEY) {
  plugins.push(captcha({ provider: 'cloudflare-turnstile', secretKey: process.env.TURNSTILE_SECRET_KEY }));
} else if (process.env.NODE_ENV !== 'production') {
  logger.warn('TURNSTILE_SECRET_KEY unset — captcha check disabled (client widget still follows VITE_TURNSTILE_SITE_KEY)');
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: {
    dialect: new PostgresDialect({
      // Own pool: auth traffic must never starve the app pool (Decision 1/3).
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      }),
    }),
    type: 'postgres',
    schemaName: 'auth', // Decision 3 — app tables stay in public
  },
  advanced: {
    // BA turns its origin/CSRF check off when NODE_ENV === "test". Pin it on:
    // the check is a security control, and letting an env name silently disable
    // it is exactly the failure mode Review Focus 2 pins (a wrong trustedOrigins
    // list must be caught by the suite, not only in production).
    disableOriginCheck: false,
    backgroundTasks: {
      // Auth mail goes out off the request path: SMTP latency must not hold the
      // sign-up / reset / verification response open. The API is long-lived
      // (Express), so the in-process send survives the response; BA's wrapper
      // logs failures.
      handler: (promise) => { promise.catch(() => {}); },
    },
    database: {
      generateId: 'uuid', // Decision 2 — uuid user ids
      // BA 1.7 introspects the schema from onRequest before every endpoint (once,
      // cached). The tables are owned by db/migrations/017 + db/schema.sql, and
      // that probe makes even GET /api/auth/ok need a live database — a DB dip
      // would 500 a request that never reads it. The migration is the authority.
      validateSchema: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    // ponytail: bcrypt(10) uniform; scrypt+rehash-on-login if review demands.
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      // Malformed/truncated legacy hashes read as "wrong password", never 500.
      verify: async ({ hash, password }) => {
        try {
          return await bcrypt.compare(password, hash);
        } catch {
          return false;
        }
      },
    },
    sendResetPassword,
    // Runs for any existing account (verified or not) when sign-up answers the
    // generic duplicate success. The HTTP response must stay identical, so the
    // only account-existence signal is the email to the address's owner.
    onExistingUserSignUp: async ({ user }) => {
      await sendExistingAccountEmail({ user });
    },
  },
  // Change-email verification reuses sendVerificationEmail (to the NEW address).
  user: { changeEmail: { enabled: true } },
  emailVerification: { sendVerificationEmail },
  hooks: {
    // Decision 11 — the server, not the client, enforces the policy, so a
    // direct POST /sign-up/email cannot bypass it.
    before: createAuthMiddleware(async (ctx) => {
      // One reset email per address per 60s, keyed by the submitted address so
      // no account lookup can reveal whether it exists. The client mirrors the
      // same window for the returning page's countdown.
      if (ctx.path === '/request-password-reset') {
        if (!canRequestReset(ctx.body?.email).allowed) {
          throw new APIError('TOO_MANY_REQUESTS', {
            message: 'A reset email was already sent. Please wait a minute before trying again.',
          });
        }
        return;
      }
      if (!['/sign-up/email', '/reset-password', '/change-password'].includes(ctx.path)) return;
      const issue = passwordPolicyError(ctx.body?.password ?? ctx.body?.newPassword);
      if (issue) throw new APIError('BAD_REQUEST', { message: issue });
    }),
    // Only an accepted request starts the window, so a failed captcha,
    // validation, or origin check never locks the address. Two concurrent
    // requests can both pass the check before either records; the client's
    // in-flight guard and the 3/60 per-IP backstop cover that tiny race.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/request-password-reset') return;
      // A handler-level rejection still reaches this hook; it sent no mail.
      if (ctx.context.returned instanceof APIError) return;
      recordResetRequest(ctx.body?.email);
    }),
  },
  plugins,
  // Pinned, not inherited: BA 1.7 already defaults these two email endpoints to
  // 3 per 60s per IP, but an upgrade may change that silently. The `before` hook
  // enforces the per-email 60s window the client mirrors; this IP rule stays as
  // a backstop against many addresses from one source.
  rateLimit: {
    enabled: true,
    customRules: {
      '/send-verification-email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
    },
  },
  // BA's default logger writes colorized free-text lines to the console, which
  // breaks the API's one-JSON-line-per-event contract. Route its events through
  // our logger; args are reduced to strings first, so a pg DatabaseError can
  // never drag query text or parameters into a log line.
  logger: {
    log: (level, message, ...args) => {
      const detail = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : undefined))
        .filter(Boolean);
      const fields = detail.length ? { source: 'better-auth', detail } : { source: 'better-auth' };
      (logger[level] ?? logger.info)(String(message), fields);
    },
  },
});
