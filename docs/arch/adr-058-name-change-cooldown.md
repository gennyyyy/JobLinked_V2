# ADR-058 — Displayed name changes are limited to once per rolling 30 days

- **Status:** Accepted
- **Date:** 2026-11-26
- **Plan:** `docs/plan/done/2026-11-26-name-change-cooldown-plan.md`

## Context

Every role can rewrite its displayed name:

- Job seeker: `PATCH /api/seekers/me` (`first_name`, `middle_name`, `last_name`, `suffix`,
  plus the legacy `full_name`-only path).
- Employer: `PATCH /api/employers/me` for the authorized representative's name.
- Super-admin: the account screen writes `full_name` through `PATCH /api/admin/users/:id`.

Nothing records when a name last changed. Repeated rewrites make applications,
referrals, and audit records refer to different identities, and the same
`PATCH /api/admin/users/:id` route is the only place PESO staff correct a name,
so an API-only fix that exempts admins would leave two inconsistent behaviours.

## Decision

1. **One displayed-name change per rolling 30 days, per account, for every role.**
   The window starts at the last accepted change and is measured in elapsed time
   (`interval '30 days'`), not calendar months.

2. **Displayed name means the value the system shows.** A patch changes the name
   when any of `first_name`, `middle_name`, `last_name`, `suffix` differs, or when
   `full_name` differs and is not being re-derived from changed components.
   Comparison is trimmed and case-insensitive, so an invite/legacy title-case
   value ("Ana Cruz") saved back as lower case is not a change. Re-saving the
   profile form without touching the name never consumes the change.

3. **Additive schema only:** one nullable `name_changed_at timestamptz` on
   `job_seekers`, `employers`, and `super_admins`. `NULL` means "never changed",
   so every existing account gets its first change for free. No backfill, no new
   table, no history rows — the audit log already records `profile.update`.

4. **Enforcement is one atomic conditional UPDATE.** The name-changing statement
   appends

   ```sql
   , name_changed_at = now()
   where id = $1
     and (name_changed_at is null or name_changed_at <= now() - interval '30 days')
   ```

   so two concurrent requests cannot both pass a check-then-write race. Zero
   affected rows means either the account is gone (404) or the window is open
   (409), distinguished by a follow-up read of `name_changed_at`.

5. **No admin exemption.** A super-admin editing another user's name respects
   that user's window; a correction inside the window is refused. Self-service and
   admin writes share the same guard module.

6. **`full_name` counts.** The legacy `full_name`-only contract and the super-admin
   account screen both write the displayed name, so they are guarded too. This
   closes the crafted `{ "full_name": "..." }` bypass. When name components are
   present in a patch, `full_name` is derived from them (ADR-046) on both the
   self-service and admin routes so the two paths agree.

7. **Reads expose the timestamp.** `to_jsonb`/`select *` means `GET /api/auth/me`,
   `GET /api/seekers/me`, and `GET /api/employers/me` gain
   `name_changed_at: string | null`. Additive and nullable; no public projection
   (`GET /api/employers/:id`) exposes it. The client derives the next allowed date
   locally to disable the fields before a save.

## API contract

Applies to `PATCH /api/seekers/me`, `PATCH /api/employers/me`, and
`PATCH /api/admin/users/:id`.

Request: unchanged (the existing allow-lists). A name-changing request inside the
window returns:

```json
{
  "error": {
    "code": "NAME_CHANGE_LIMIT",
    "message": "You can change your name again on Dec 26, 2026."
  }
}
```

- Status: `409 Conflict`
- The whole patch is refused; non-name fields in the same request are not saved.
- A permitted change returns the existing `200` shape (the updated row) and now
  carries `name_changed_at`.
- A patch that sends only unchanged name values returns `200` and does not stamp.

## Schema

`db/schema.sql` (fresh install) and `db/migrations/020_name_change_cooldown.sql`
(existing databases), both additive and idempotent:

```sql
alter table public.job_seekers  add column if not exists name_changed_at timestamptz;
alter table public.employers    add column if not exists name_changed_at timestamptz;
alter table public.super_admins add column if not exists name_changed_at timestamptz;
```

Rollback: drop the three columns. The server falls back to unlimited changes
because the guard reads the column; no other object depends on it.

## Consequences

- Name changes become a deliberate monthly action for every role; the profile UI
  shows the next allowed date and disables only the name fields.
- PESO staff cannot fix a typo'd name inside the user's 30-day window through the
  app. Out-of-band `psql` correction remains possible but is not an API surface.
- Every save that touches a name field now performs one extra `SELECT` to compare
  the stored values. Saves that touch no name field are unchanged.
- Name-change history is not stored; only the last change time. If a future
  requirement needs a full trail, add a `name_change_log` table then — this ADR
  deliberately does not build it now.
- `auth."user"."name"` (Better Auth) is not written by these routes and stays
  untouched; the role row is the displayed identity, as it already was.

## Alternatives rejected

- **Separate `name_change_log` table:** no requirement for history; a nullable
  timestamp answers "when may I change it again?" in one row.
- **Calendar-month window:** a change on the 31st could be followed by another on
  the 1st. The product chose rolling 30 days.
- **Admin exemption:** rejected by the product owner; corrections are blocked
  inside the window.
- **Limiting `company_name`:** business identity is governed by accreditation, not
  personal-identity abuse; out of scope.
- **Application-layer `SELECT` then `UPDATE`:** TOCTOU race; the conditional
  UPDATE is the guard.
