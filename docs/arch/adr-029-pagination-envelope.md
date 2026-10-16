# ADR-029 — Pagination envelope and the shared `pageParams` guard [ACCEPTED 2026-10-16]

## Context

The five admin lists (`/admin/users`, `/admin/companies`, `/admin/jobs`,
`/admin/applications`, `/admin/accreditations`) and `GET /employers/:employerId/jobs`
returned unbounded arrays, so clients paginated in JS or not at all — the root cause
behind phase-1's top API gap and of F-03/F-04 (audit-log user dropdown and page
filters silently running over the first 25 rows). The opposite failure is just as
real: an unbounded `?page=` reaching Postgres OFFSET is a DoS-shaped bug, and junk
values were either a 22P02/500 or silently defaulted.

## Decision

1. **One response shape: `{ data, total, page, pageSize }`** on the five admin lists
   and `GET /employers/:employerId/jobs`; `total` is the filtered count computed
   before LIMIT/OFFSET. `GET /jobs` keeps its legacy key `jobs` — the public client
   reads `.jobs`; no rename without a client change.
2. **One guard: `pageParams(res, q, defaultSize, maxSize)`** in `util.js:52` — used at
   8 sites, nowhere else hand-rolled. `Number()` (not `parseInt`: `parseInt('1e21')`
   silently truncates to page 1); a present-but-junk value is 400 `BAD_REQUEST` sent
   by the guard; `page` clamped ≤ 1,000,000 and `pageSize` ≤ maxSize so an absurd
   OFFSET cannot overflow the SQL. Defaults 25/500 (admin lists, employer jobs),
   10/100 (public jobs), 500/2000 (report exports).
3. **Deliberately NOT paginated** — plain arrays, documented as such in
   `02-api-contract.md` under "Known unbounded gaps": `/admin/employees`,
   `/admin/referrals`, `GET /applications/job/:jobId`,
   `GET /applications/company/:companyId`. Paginate each when its row count outgrows
   one screen; that list is the pagination backlog, not an oversight.

## Consequences

- One shared `Pager` (`shared/components/dashboard.jsx:75`) renders every list from
  server-supplied `total`/`page`/`pageSize`, so the client-filter-over-one-page class
  of bug (F-03/F-04) cannot recur.
- `?page=abc` is now a 400 instead of a silent page 1 — breaking for nobody, since no
  client sends junk.
- Enum-valued filters on the same routes are validated before SQL (400, not a 22P02
  500) — same trust-boundary rule, but a separate change from this ADR.
- The envelope is intentionally not universal; a future agent finding a plain-array
  list should check the contract's unbounded-gaps list before assuming a bug.
