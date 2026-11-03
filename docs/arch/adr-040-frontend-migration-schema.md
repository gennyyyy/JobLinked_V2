# ADR-040 — New tables and one column, shipped via migration 010 + schema.sql [ACCEPTED 2026-11-03]

## Context
The UI already has screens for four things the backend cannot store: saved jobs, announcement CRUD,
employment correction requests, and a job-application cover letter. No other backend capability is
needed by this migration (gap decisions in §1.1 of the plan).

Schema changes must go through `db/schema.sql` (source of truth) and `psql` per `db/README.md`.

## Decision
Add exactly these, nothing else:

| Change | Shape |
|---|---|
| `saved_jobs` | `id bigint identity`, `seeker_id`, `job_id`, `created_at`, `unique (seeker_id, job_id)`, index on `seeker_id`; both FKs `on delete cascade` |
| `announcements` | `id uuid`, `title`, `body`, `category` default `General`, `status` in (`draft`,`published`), `author_id`, `published_at`, `created_at`, `updated_at`; index on (`status`, `published_at desc`) |
| `employment_corrections` | `id uuid`, `employment_id` FK cascade, `seeker_id` FK cascade, `message`, `status` in (`Pending`,`Reviewed`), `resolution`, `reviewed_by`, `reviewed_at`, `created_at`; indexes on `seeker_id` and `status` |
| `job_applications.cover_letter` | `text null` |

Shipping rule: `db/migrations/010_frontend_migration.sql` holds the work copy; the same idempotent
`create table if not exists` / `add column if not exists` statements are mirrored into `db/schema.sql`
next to their domain (saved jobs after `resumes`; announcements + corrections after `notifications`;
`cover_letter` in the `create table job_applications` body *and* as the idempotent `alter`).

## Consequences
- Migration is additive and re-runnable; no existing column is dropped or retyped.
- Publishing an announcement fans out notifications exactly once (`published_at is null` guard).
- `cover_letter` is capped at 3000 characters in the route, not by a DB constraint.
- No `saved_jobs` uniqueness by anything other than `(seeker_id, job_id)`; duplicate saves are
  idempotent at the API.

## Alternatives
- **JSON blob column on an existing table** — no referential integrity, no cascade on job deletion. Rejected.
- **Schema-first only (edit `schema.sql`, no migration file)** — existing databases would never get the
  tables. Rejected.
