#!/usr/bin/env node
// Supabase Auth → Better Auth data migration (ADR-056 Decision 10, plan Task 3).
//
//   node server/scripts/migrate-supabase-auth.mjs                     # dry run: counts only
//   node server/scripts/migrate-supabase-auth.mjs --dry-run           # same as the default
//   node server/scripts/migrate-supabase-auth.mjs --apply             # write auth."user"/"account"
//   node server/scripts/migrate-supabase-auth.mjs --apply --batch=500 --resume=<userId>
//
// Source: the Supabase Postgres database, read-only (SUPABASE_DATABASE_URL).
// The admin API is not usable: it omits encrypted_password (measured 0/161).
// Target: DATABASE_URL. Sessions and MFA factors do not migrate.
// Logs counts only — never emails, hashes, URLs, or tokens.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

// Runs before the client flips to BA (Decision 10), so the upsert may land on a
// user a previous run already created: keep the app-owned role it carries.
const USER_UPSERT = `
  insert into auth."user"
    ("id","name","email","emailVerified","image","createdAt","updatedAt","role","banned","twoFactorEnabled")
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  on conflict ("id") do update set
    "email" = excluded."email",
    "emailVerified" = excluded."emailVerified",
    "updatedAt" = excluded."updatedAt",
    "role" = coalesce(auth."user"."role", excluded."role")`;

// Guarded so a re-run never duplicates the credential account nor overwrites a
// password the user changed after the first run. The ::uuid/::text casts name
// the parameter types Postgres would otherwise infer inconsistently
// ("accountId" is text, "userId" is uuid).
//
// ponytail: two concurrent runs could still race between the not-exists check
// and the insert. Run once; add a unique (userId, providerId) index if
// concurrent runs ever matter.
const ACCOUNT_INSERT = `
  insert into auth."account"
    ("id","accountId","providerId","userId","password","createdAt","updatedAt")
  select $1::uuid, $1::text, 'credential', $1::uuid, $2, $3, $3
  where not exists (
    select 1 from auth."account" where "userId" = $1::uuid and "providerId" = 'credential'
  )`;

// Keyset-paginated read, ordered by id, from the only source that still holds
// Supabase password hashes. $1 = previous page's last id (null on the first
// page; a resume id starts after it), $2 = batch size.
const SOURCE_PAGE = `
  select id, email, encrypted_password, email_confirmed_at, created_at,
         raw_user_meta_data, raw_app_meta_data
  from auth.users
  where ($1::uuid is null or id > $1::uuid)
  order by id
  limit $2`;

// The Supabase connection must never be able to write.
export function sourceClientConfig(connectionString) {
  return { connectionString, options: '-c default_transaction_read_only=on' };
}

// Fail closed before any connection: hashes are the point of this migration.
export function envError(env = process.env) {
  const missing = ['SUPABASE_DATABASE_URL', 'DATABASE_URL'].filter((key) => !env[key]);
  return missing.length ? `missing env: ${missing.join(', ')}` : null;
}

// Pure mapping. Supabase `encrypted_password` (bcrypt $2a$) is carried verbatim
// for BA's bcrypt verify (Decision 4). `auth."user"."email"` is NOT NULL, so a
// source row without one cannot be represented and is skipped by the caller.
export function mapUser(row) {
  const meta = row.raw_user_meta_data ?? {};
  const appMeta = row.raw_app_meta_data ?? {};
  return {
    user: {
      id: row.id,
      name: meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || row.email,
      email: row.email,
      emailVerified: row.email_confirmed_at != null,
      image: null,
      createdAt: row.created_at,
      updatedAt: new Date(),
      role: appMeta.role ?? null,
      banned: false,
      twoFactorEnabled: false,
    },
    password: row.encrypted_password ?? null,
  };
}

export async function runMigration({ source, db, flags = {}, log = (line) => console.log(JSON.stringify(line)) }) {
  const apply = Boolean(flags.apply);
  const batch = flags.batch ?? 500;
  const counts = { total: 0, verified: 0, withPassword: 0, usersWritten: 0, accountsWritten: 0, skipped: 0 };
  let cursor = flags.resume ?? null;

  for (;;) {
    const { rows } = await source.query(SOURCE_PAGE, [cursor, batch]);
    if (!rows.length) break;

    for (const row of rows) {
      const { user, password } = mapUser(row);
      if (!user.email) {
        counts.skipped += 1;
        continue;
      }

      counts.total += 1;
      if (user.emailVerified) counts.verified += 1;
      if (password) counts.withPassword += 1;
      if (!apply) continue;

      await db.query(USER_UPSERT, [
        user.id, user.name, user.email, user.emailVerified, user.image,
        user.createdAt, user.updatedAt, user.role, user.banned, user.twoFactorEnabled,
      ]);
      counts.usersWritten += 1;

      if (password) {
        const inserted = await db.query(ACCOUNT_INSERT, [user.id, password, user.updatedAt]);
        counts.accountsWritten += inserted.rowCount ?? 0;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < batch) break;
  }

  const summary = { event: 'migrate_supabase_auth', ...counts };
  log(summary);
  return summary;
}

function parseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const batch = Number(value('batch'));
  return {
    apply: argv.includes('--apply'),
    batch: Number.isInteger(batch) && batch > 0 ? batch : 500,
    resume: value('resume') || null,
  };
}

// Same pattern as server/scripts/seed-registration-spike.mjs: read server/.env
// next to this script, never override the real process env.
function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
      if (match && !(match[1] in process.env)) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* env may come from the process */ }
}

async function main() {
  loadEnv();
  const flags = parseArgs(process.argv.slice(2));
  const issue = envError();
  if (issue) {
    console.error(JSON.stringify({ event: 'migrate_supabase_auth_failed', message: issue }));
    process.exitCode = 1;
    return;
  }

  const source = new pg.Client(sourceClientConfig(process.env.SUPABASE_DATABASE_URL));
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    await source.connect();
    await runMigration({ source, db, flags });
  } catch (error) {
    console.error(JSON.stringify({ event: 'migrate_supabase_auth_failed', message: error?.message || String(error) }));
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([source.end(), db.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
