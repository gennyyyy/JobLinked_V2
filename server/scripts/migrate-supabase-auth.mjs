#!/usr/bin/env node
// Supabase Auth → Better Auth data migration (ADR-056 Decision 10, plan Task 3).
//
//   node server/scripts/migrate-supabase-auth.mjs                     # dry run: counts only
//   node server/scripts/migrate-supabase-auth.mjs --dry-run           # same as the default
//   node server/scripts/migrate-supabase-auth.mjs --apply             # write auth."user"/"account"
//   node server/scripts/migrate-supabase-auth.mjs --apply --batch=500 --resume=<userId>
//
// Source: Supabase admin API (service role). Target: DATABASE_URL.
// Sessions and MFA factors do not migrate: every user signs in once.
// Logs counts only — never emails, hashes, or tokens.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

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

// Pure mapping. Supabase `encrypted_password` (bcrypt $2a$) is carried verbatim
// for BA's bcrypt verify (Decision 4). `auth."user"."email"` is NOT NULL, so a
// source user without one cannot be represented and is skipped by the caller.
export function mapUser(supabaseUser) {
  const meta = supabaseUser.user_metadata ?? {};
  const appMeta = supabaseUser.app_metadata ?? {};
  return {
    user: {
      id: supabaseUser.id,
      name: meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || supabaseUser.email,
      email: supabaseUser.email,
      emailVerified: supabaseUser.email_confirmed_at != null,
      image: null,
      createdAt: supabaseUser.created_at,
      updatedAt: new Date(),
      role: appMeta.role ?? null,
      banned: false,
      twoFactorEnabled: false,
    },
    password: supabaseUser.encrypted_password ?? null,
  };
}

export async function runMigration({ supabase, db, flags = {}, log = (line) => console.log(JSON.stringify(line)) }) {
  const apply = Boolean(flags.apply);
  const batch = flags.batch ?? 500;
  const counts = { total: 0, verified: 0, withPassword: 0, usersWritten: 0, accountsWritten: 0, skipped: 0 };

  // The admin API has no id cursor, so --resume rescans pages and skips through
  // the given id (the guide's `id > $1`). Idempotent writes make the re-scan free.
  let skipping = Boolean(flags.resume);

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: batch });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const users = data?.users ?? [];

    for (const supabaseUser of users) {
      if (skipping) {
        if (supabaseUser.id === flags.resume) skipping = false;
        continue;
      }

      const { user, password } = mapUser(supabaseUser);
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

    if (users.length < batch) break;
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
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(JSON.stringify({ event: 'migrate_supabase_auth_failed', message: `missing env: ${missing.join(', ')}` }));
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    await runMigration({ supabase, db, flags });
  } catch (error) {
    console.error(JSON.stringify({ event: 'migrate_supabase_auth_failed', message: error?.message || String(error) }));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
