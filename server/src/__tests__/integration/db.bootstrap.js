import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 1 (docs/plan/2026-11-04-05-testing-plan.md): real-Postgres slice.
// Applies db/schema.sql + db/seed.sql to a scratch database, run per suite.
// Two hard rules:
//   1. The target database name MUST end in `_test` (failure mode #3 — never
//      touch the developer's `joblinked` dev DB). A wrong name THROWS.
//   2. A missing/unreachable local Postgres SKIPS (returns ready:false)
//      instead of failing the suite.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const DEFAULT_TEST_DB_URL = 'postgres://postgres:postgres@localhost:5432/joblinked_test';

// Normalised once so credentials with spaces/escapes survive both the WHATWG
// parse below and pg's connection-string parser.
export function scratchUrl(raw) {
  const u = new URL(raw); // malformed URL = config error, fail loud
  const name = u.pathname.replace(/^\/+/, '');
  if (!name.endsWith('_test')) {
    throw new Error(`Integration target must be a *_test database (got "${name || raw}") — refusing to touch it`);
  }
  return { url: u.href, name };
}

const maintenanceUrl = (url) => { const u = new URL(url); u.pathname = '/postgres'; return u.href; };

async function tryConnect(pg, connectionString) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 2000, application_name: 'joblinked-integration-bootstrap' });
  try { await client.connect(); return client; } catch { return null; }
}

export async function setupIntegrationDb() {
  if (process.env.INTEGRATION_TEST !== '1') {
    return { ready: false, reason: 'INTEGRATION_TEST is not 1 — integration suite skipped' };
  }
  const { url, name } = scratchUrl(process.env.INTEGRATION_DATABASE_URL || DEFAULT_TEST_DB_URL);
  const { default: pg } = await import('pg');

  let client = await tryConnect(pg, url);
  let created = false;
  if (!client) {
    // The scratch DB may simply not exist yet — create it from the maintenance
    // database. No maintenance access at all = no local Postgres (or wrong
    // credentials): skip cleanly, never fail on an absent dev box.
    const admin = await tryConnect(pg, maintenanceUrl(url));
    if (!admin) return { ready: false, reason: `Postgres not reachable at ${new URL(url).host} — integration suite skipped` };
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (!exists.rowCount) { await admin.query(`create database "${name}"`); created = true; }
    await admin.end();
    client = await tryConnect(pg, url);
  }
  if (!client) return { ready: false, reason: `could not open scratch database "${name}" — integration suite skipped` };

  await client.query('drop schema if exists public cascade; create schema public');
  await client.query(fs.readFileSync(path.join(repoRoot, 'db', 'schema.sql'), 'utf8'));
  await client.query(fs.readFileSync(path.join(repoRoot, 'db', 'seed.sql'), 'utf8'));
  await client.end();

  // db.js builds its pool at import time from DATABASE_URL — point it at the
  // scratch DB before anything imports db.js. Also keep admin.js's 24h
  // retention timer out of the test process.
  process.env.DATABASE_URL = url;
  process.env.RETENTION_DISABLE ||= '1';
  return { ready: true, url, dbName: name, created };
}
