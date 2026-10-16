import logger from './logger.js';

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  logger.error('missing required env — see server/.env.example', { missing });
  process.exit(1);
}
