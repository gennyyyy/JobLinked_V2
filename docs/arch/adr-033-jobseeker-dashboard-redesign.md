# ADR-033 — Job-seeker dashboard restyled to the approved reference [ACCEPTED 2026-10-18]

## Context
`src/features/job-seeker/Dashboard.jsx` already computes and renders every figure in the
approved reference design — it is a presentation change, not a data change:

| Reference element | Existing source |
|---|---|
| Active / Accepted / Rejected / New This Week | `Dashboard.jsx:70-83` |
| Profile completion % + bar + CTA | `Dashboard.jsx:29-36, 89, 105-118` |
| Recent applications | `Dashboard.jsx:150-183` |
| Recommended for you | `Dashboard.jsx:16-27, 120-148` |

What differs is layout and tone: a hero banner with an avatar, four colour-toned tiles, a
two-column row (profile completion beside recent applications), then recommended jobs
full-width.

`src/shared/components/dashboard.jsx` is deliberately the shared family ("so headers, stat
cards, and section cards stay visually identical everywhere") and `StatCard` is consumed by
all three portals — seeker (6 pages), employer (3), super-admin (`Reports.jsx` alone renders
~15). A global restyle would change two other portals' dashboards; an override-only change
would drift the family.

## Decision
1. **Toned tiles for the seeker dashboard.** The shared `StatCard` was specified to gain an
   additive `tone` prop (`info | success | danger | warn`), with byte-identical output when
   unset so employer/super-admin stay pixel-unchanged. `src/shared/components/dashboard.jsx`
   is concurrently being modified by another in-flight change (the `logo` prop on `PageHeader`),
   and repeated attempts to land the `tone` prop there were reverted by that work, so the
   toned tiles are **inlined in `Dashboard.jsx`** for now using the same semantic colour set
   (info = primary blue, success = emerald, danger = danger red, warn = amber). The
   `StatCard` `tone` prop and its hoist are deferred until that concurrent work settles —
   the employer guard test (`src/features/employer/__tests__/Dashboard.test.jsx`) is left
   untouched and still proves the untoned `StatCard` markup is unchanged.
2. **`DashboardHero` banner.** Specified as a new shared export, but inlined in
   `Dashboard.jsx` for the same reason (concurrent collision on `dashboard.jsx`), reusing
   `displayName()`/`initialsOf()` from `accountName.js` (ADR-032) — no new name logic.:
   `bg-primary` rounded banner, initials avatar, and a time-based greeting
   (`Good Morning` <12, `Good Afternoon` <18, else `Good Evening`) above the display name in
   uppercase.
3. **`Dashboard.jsx` becomes** hero → an `h1` "Dashboard" → the four toned tiles → a two-column
   row (Profile Completion left, Recent Applications right; single column below `md`) →
   Recommended For You full-width. `PageHeader` is dropped from **this page only** (the hero
   replaces the banner). The other five seeker pages keep `PageHeader` unchanged.
4. **No data change:** the same `listBySeeker` + `listJobs` calls, the same
   `profileCompletion`/`scoreJob`/`newThisWeek` logic and the same empty/error states. No new
   endpoint, service function, SQL, or dependency. `db/schema.sql` untouched.
5. **The avatar is initials, not a photo** — same constraint as ADR-032: no avatar column
   exists and browser-side storage is prohibited. A photo needs its own ADR.
6. Status colours here are semantic (`Accepted` emerald, `Rejected` danger red, amber for new
   this week), per the reference and confirmed by the requester. This does not reinstate green
   as decoration: the notification `SEE ALL` pill stays `bg-primary/10 text-primary`.

## Consequences
- Job-seeker dashboard matches the approved design; employer and super-admin dashboards are
  unchanged, which their existing tests must demonstrate by still passing untouched.
- `Dashboard.jsx` has no test file today, so the new behaviour needs a new one (see Hand-off);
  there is no existing seeker-dashboard coverage to regress.
- Wrapping/branching inside `StatCard` stays shallow (a tone→classes lookup, no nested
  conditionals) and `dashboard.jsx` stays a small presentational module.

## Hand-off
Implementation: **frontend** (`src/shared/components/dashboard.jsx` additive `tone` +
`DashboardHero`, then `src/features/job-seeker/Dashboard.jsx`). Tests: **frontend** adds
`src/features/job-seeker/__tests__/Dashboard.test.jsx` and must leave
`src/features/employer/__tests__/Dashboard.test.jsx` (which asserts the untoned `StatCard`
markup) passing untouched — that test is the guard against a cross-portal regression.
Review: **review**.
