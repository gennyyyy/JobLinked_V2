# ADR-039 — Role-row resolution: `inactive` means stale, nothing else

- **Status:** Accepted
- **Date:** 2026-11-05
- **Context:** Live campaign finding D1 (`docs/arch/testing/2026-11-05-campaign.md`)
- **Affects:** `resolveRole` (`server/src/auth.js`), `findUserTable` and the
  `/api/admin/users` union (`server/src/routes/admin.js`)

## Context

A role move (`POST /api/admin/users/:id/role`) never deletes the old row — the
FK cascade would destroy the user's jobs, applications, and applicant PII.
Instead it sets the old row to `status = 'inactive'` and upserts the target row
as `active`.

That makes `inactive` a **stale marker**, but the resolver treated all three
account states (`active`, `inactive`, `suspended`) as one ranking:
`order by (status = 'active') desc, ord`. With a stale row in a
*higher-precedence* table, a suspended *current* row loses:

| row | table | status | precedence |
|---|---|---|---|
| current | `job_seekers` | `suspended` | 3 |
| stale | `employers` | `inactive` | 2 |

`findUserTable` returned `employers`, so
`PATCH /api/admin/users/:id { status: 'active' }` answered **200** while
updating the stale employer row; the seeker stayed suspended and locked out.
Reproduced live: PATCH 200, then `job_seekers.status = 'suspended'` and
`employers.status = 'active'`.

## Decision

Rank "not stale" before "active":

```sql
order by (profile->>'status' <> 'inactive') desc,
         (profile->>'status' = 'active') desc,
         ord
```

Applied identically in `resolveRole`, `findUserTable`, and the
`/admin/users` `distinct on (id)` inner ordering (and mirrored by the test
harness `unionOrder`). `PATCH /api/admin/users/:id` **rejects**
`status: 'inactive'` with 400 — the admin UI only offers Active/Suspended, and
accepting the reserved marker re-opens the ambiguity.

## Consequences

- A suspended account resolves to its real role/table and can be reinstated.
- Existing data needs no migration: rows already `inactive` are by definition
  the output of a role move (the UI never produced that value).
- Role moves still deactivate rather than delete; data preservation is
  unchanged.
- One residual: a client that sent `inactive` to `PATCH /api/admin/users/:id`
  now gets 400. No UI or documented client did.
