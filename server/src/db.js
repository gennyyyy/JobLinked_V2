import pg from 'pg';

// Keep PostgreSQL DATE values as YYYY-MM-DD strings; converting them to JS
// Date objects adds a timezone and can shift birthdays by one day.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
