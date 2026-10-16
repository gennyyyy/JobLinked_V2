import pg from 'pg';

// Keep PostgreSQL DATE values as YYYY-MM-DD strings; converting them to JS
// Date objects adds a timezone and can shift birthdays by one day.
pg.types.setTypeParser(1082, (value) => value);

// M5: explicit pool sizing — max 20 under load, fail fast instead of queueing
// forever when the database is saturated, and reap idle connections.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
