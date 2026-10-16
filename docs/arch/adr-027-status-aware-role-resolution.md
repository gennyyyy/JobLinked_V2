# ADR-027 — Status-aware role resolution; role moves never delete [SIGNED OFF 2026-10-16]

## Context

A user's role lives in one of three tables — `super_admins`, `employers`, `job_seekers` — keyed by the same Supabase user id, each row carrying `status account_status not null default 'active'` (`db/schema.sql:50,89,104`), so a role move creates a **second row for the same id**. `POST /api/admin/users/:id/role` used to `delete` the old row and insert the new one, but `job_vacancies.company_id → employers(id) ON DELETE CASCADE` (`:178`) and `job_applications.job_id → job_vacancies(id) ON DELETE CASCADE` (`:226`) mean one `delete from employers` erases every posting the company made, every application to those postings, and their history children — one request, no confirmation, no undo, destroying the *applicants'* records, which belong to other citizens.

## Decision

1. **A role move is a deactivate + upsert, never a delete**: `update <old> set status='inactive'` and `insert … on conflict (id) do update set … status='active'`, both inside `withTransaction` (`routes/admin.js:680-686`). Moving back onto a table that still holds the deactivated row reactivates it instead of raising 23505 (the original B2 500). 403 on self-move.
2. **Role resolution is status-aware.** `resolveRole` (`auth.js:17-27`) and `findUserTable` (`admin.js:109-121`) read `order by (profile->>'status' = 'active') desc, ord limit 1`; `GET /admin/users` dedupes with `distinct on (id) … order by id, (profile->>'status'='active') desc, ord` before any filter applies. The status term is **first** because a moved user now legitimately occupies two rows; `ord` (super-admin → employer → job-seeker) is only the tiebreak among rows of the same status, preserving the old loop precedence. So the active row wins and a stale row can never be returned, shadow a role, or leak through `?role=`/`?status=`/`?search=`.
3. **Deactivated rows are kept forever** — the audit trail of the move and the anchor keeping the FK cascade out of reach. A future "clean up stale role rows" task must **not** delete them; the bug is one DELETE away.

## Consequences

- Reversible, non-destructive; a permanently inactive row per move is intended.
- The status term relies on `status` being `not null default 'active'` in all three tables, so the expression is never NULL and Postgres's DESC `NULLS FIRST` default cannot invert the active-first rule. A nullable `status` column needs `nulls last` or this breaks silently.
- Known ceiling (`ponytail:` in `admin.js`): a `?role=` filter naming the *old* table still returns the deactivated row, because the union spans one table. No live-Postgres verification here; `db/schema.sql` closes the NULL hole on paper only — re-run against a real DB.
