import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import bcrypt from 'bcrypt';
import { admin, captcha, twoFactor } from 'better-auth/plugins';
import { sendResetPassword, sendVerificationEmail } from './mailer.js';
import { passwordPolicyError } from './passwordPolicy.js';

// The only place betterAuth() is configured. Later tasks import { auth }.
const trustedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// BA rejects credential POSTs whose Origin is untrusted, so local dev needs
// these even when CORS_ORIGIN points at a deployed origin.
if (process.env.NODE_ENV !== 'production') {
  trustedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
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
  advanced: { database: { generateId: 'uuid' } }, // Decision 2 — uuid user ids
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
  },
  // Change-email verification reuses sendVerificationEmail (to the NEW address).
  user: { changeEmail: { enabled: true } },
  emailVerification: { sendVerificationEmail },
  hooks: {
    // Decision 11 — the server, not the client, enforces the policy, so a
    // direct POST /sign-up/email cannot bypass it.
    before: createAuthMiddleware(async (ctx) => {
      if (!['/sign-up/email', '/reset-password', '/change-password'].includes(ctx.path)) return;
      const issue = passwordPolicyError(ctx.body?.password ?? ctx.body?.newPassword);
      if (issue) throw new APIError('BAD_REQUEST', { message: issue });
    }),
  },
  plugins: [
    admin(),
    twoFactor(),
    captcha({ provider: 'cloudflare-turnstile', secretKey: process.env.TURNSTILE_SECRET_KEY }),
  ],
  rateLimit: { enabled: true },
});
