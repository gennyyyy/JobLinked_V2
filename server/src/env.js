import logger from './logger.js';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  logger.error('missing required env — see server/.env.example', { missing });
  process.exit(1);
}

// Better Auth's production config (ADR-056). WARN-only until Task 12 flips the
// cutover: dev/test boots without them (BA falls back to a dev baseURL, and the
// mailer logs action URLs instead of sending), so this must never exit yet.
// Task 12 moves these into `required` once the deployment owns the real values.
const recommended = ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'TURNSTILE_SECRET_KEY', 'SMTP_HOST'];
const missingRecommended = recommended.filter((k) => !process.env[k]);
if (missingRecommended.length) {
  logger.warn('missing better-auth env — see server/.env.example', { missing: missingRecommended });
}
