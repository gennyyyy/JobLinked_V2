# DB plan — local Postgres via pgAdmin4 (`db/` is the source of truth)

## New files (backend agent creates)
- `db/schema.sql` — portable Postgres, derived from `supabase/migration.sql`:
  KEEP tables, columns, defaults, native enums (minus `fb_post_status`,
  already dropped), `pgcrypto` extension, `reference_data` seeds,
  `record_accepted_employment()` + `sync_employer_accreditation_status()`
  triggers (plain plpgsql, no auth-schema refs — verify while porting).
  DROP: `references auth.users` (role PKs become plain `uuid primary key`),
  all RLS (`enable row level security`, policies, `is_admin()` /
  `is_accredited_employer()` helpers), `notify_admins()` (API inserts
  directly), `handle_new_user()` + trigger (replaced by `/provision`),
  legacy `profiles`/`companies` migration block, Supabase storage bucket
  policies. File upload columns (`file_path`, `file_name`) stay — they now
  point at API-served relative paths.
- `db/seed.sql` — `reference_data` rows only (employment types, education
  levels). No demo users: accounts are created via signup + `/provision`.
- `db/README.md` — pgAdmin4 server registration (localhost:5432), create
  database `joblinked`, run `schema.sql` then `seed.sql` (Query Tool or
  `psql -f`), plus:
  - deploy dump: `pg_dump -Fc joblinked > joblinked.dump` /
    `pg_restore -d <newdb> joblinked.dump` (this is the "not difficult to
    deploy later" path — same file restores to any Postgres, incl. Supabase).
  - Supabase-later path: `supabase/migration.sql` is RETAINED untouched as
    the Supabase-target schema; moving back = restore dump, re-add auth FKs,
    RLS, storage. No action now.

## pgAdmin4 workflow
Browse/edit data in pgAdmin4; schema changes NEVER via pgAdmin GUI — edit
`db/schema.sql`, apply with `psql`/Query Tool, commit. Nothing alters schema
without architect approval (standing rule).

## Files on disk
API stores uploads under `server/uploads/{resumes,documents}/<userId>/<uuid>-<safe-name>`
(gitignored). DB keeps the relative path. Move-to-S3/Storage later = copy
files + prefix change only.
