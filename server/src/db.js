import pg from 'pg';
import logger from './logger.js';

// Keep PostgreSQL DATE values as YYYY-MM-DD strings; converting them to JS
// Date objects adds a timezone and can shift birthdays by one day.
pg.types.setTypeParser(1082, (value) => value);

// M5: explicit pool sizing — max 20 under load, fail fast instead of queueing
// forever when the database is saturated, and reap idle connections.
// statement_timeout / idle_in_transaction_session_timeout go into the startup
// packet (pg supports them per connection): a query wedged on a lock or a
// leaked transaction can never pin a pool slot forever — 20 wedged slots used
// to be the whole API answering 503 until it was restarted by hand.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 120_000,
  idle_in_transaction_session_timeout: 180_000,
});

// Stability: when Postgres drops an idle pooled connection (server restart,
// machine sleep/resume, idle reap, network blip) pg-pool emits 'error'. An
// EventEmitter with no 'error' listener THROWS, which killed the whole process
// — and `node --watch` does not respawn a crashed child, so the API stayed dead
// until the dev command was restarted by hand. The pool already discarded the
// broken client and opens a fresh one on the next query, so log and keep going.
pool.on('error', (e) => logger.error('db_pool_error', { code: e?.code, message: e?.message }));
