# System Gap Analysis — what is lacking, what to improve (2026-11-04)

**For agentic workers:** implement only with Lead Architect sign-off. This is the
INPUT document for the other plans in `plan/` — do not implement its rows here,
follow the linked plan.

**Goal:** one evidence-based register of real gaps in the system, so plans stay
grounded in today's code instead of the stale 2026-10-16 gap matrix.

**Method:** fresh inventory of `src/` (routes, features, services, tests),
`server/` (all routes + infra + tests), `db/schema.sql` + migrations 001–009,
`to_do.md`, `docs/arch/gap-matrix.md` (2026-10-16, partly stale), and the ADR
backlog. Every row cites a today-verified file:line or agent-verified location.

**Snapshot:** the system is far more complete than `to_do.md` implies. 100+ test
files, axe-core a11y tests, server-side auth/ownership on every sensitive route,
parameterized SQL everywhere, rate limiting, audit logs, 9 applied migrations,
signed-off ADRs for every avoided feature. The real gaps are structural
(routing), compliance (legal text), one security decision, and operations
(production topology/backups), plus a small product-completion set.

## Gap register (ordered by severity)

| ID | Gap | Evidence (2026-11-04) | Severity | Plan |
|---|---|---|---|---|
| G1 | No real URLs anywhere: `MemoryRouter` seeded once; address bar frozen, back button exits the app, nothing bookmarkable or shareable | `src/App.jsx:63-68`; `vercel.json` already has the SPA rewrite that `BrowserRouter` needs | **High** | 02 |
| G2 | `/privacy` and `/terms` render the same placeholder body (`TERMS_PLACEHOLDER`); TermsModal uses a placeholder too — PH Data Privacy Act (RA 10173) copy legally needed | `src/shared/components/Legal.jsx:14`, TermsModal | **High** | 04 |
| G3 | Custom-role permission bundles are edited in super-admin UI but enforced nowhere server-side — they only shape what the SPA renders; permissions are a decoration on `requireRole('super-admin')` | `server/src/routes/admin.js` (roles CRUD → `reference_data.details`), documented in-code | **High** | 04 (ADR-036) |
| G4 | Production API topology unresolved: uploads persist to local disk (`server/src/upload.js`, `UPLOAD_DIR` default `./uploads`) and rate limiting is in-memory — both are single-persistent-node invariants; deploying the API to serverless would corrupt uploads and lift limits | `server/src/db.js`, `middleware/rateLimit.js`, in-code caveats | **High** | 06 (ADR-037) |
| G5 | No automated backups / no restore drill on record; db/README has the manual `pg_dump` command only | `db/README.md` | **High** | 06 |
| G6 | Testing blind spots: everything server-side is tested with a mocked pool; no real-Postgres test ever runs; no browser E2E for any critical flow; untested areas: file-serving path guard, upload disk behavior, `notifyMatchingSeekers` matching, `runRetentionPurge` | `server/vitest.config.js`, `server/src/__tests__/helpers/db.js` | **Med** | 05 |
| G7 | Employer cannot view an applicant's resume from the UI — the server route exists (`GET /api/files/:bucket/*` joins `job_applications` for linked employers) but the row action was removed in the Phase-6 cleanup | `server/src/routes/profiles.js:298-301`, `employer/Applicants.jsx` | **Med** | 03 |
| G8 | Admin seeker depth: PESO can see name/email only; per-seeker education/experience/employment endpoints exist server-side but no UI tab; admin resume view missing | `to_do.md` §3; `server` admin routes for `/admin/seekers/:id/education\|experience\|employment` exist | **Med** | 03 |
| G9 | `AiMatchModal` is a fake: replies "Not connected yet — backend coming" while a real AI endpoint (`POST /api/ai/help`, OpenRouter relay, rate-limited) already serves `HelpChat` | `job-seeker/AiMatchModal.jsx:8,19` vs `server/src/routes/ai.js` | **Med** | 03 (decision) |
| G10 | Dark mode dormant: `.dark` variant + ~22 `dark:` usages exist, but there is no toggle/provider; every shell hardcodes light; a signed design spec exists and was never implemented | `src/index.css`, `docs/superpowers/specs/2026-10-18-dark-mode-design.md` | **Med** | 03 (decision) |
| G11 | Monoliths: `employer/JobPosts.jsx` 1090 lines, `job-seeker/Profile.jsx` 730 lines, `server/src/routes/admin.js` 697 lines with notifications inside it (ADR-026 ratified, never executed) | file sizes | **Med** | 03 |
| G12 | Dead components still shipped: `SiteHeader`, `SiteFooter`, `AccountMenu`, `NotificationBell`, and the `ApplicantsShell → CardListLayout → SearchBar` chain (kept alive by their own tests); sonner dep + wrapper mounted but zero `toast()` calls → two competing toast systems, one dead | sampled imports; `src/components/ui/sonner.jsx` | **Med** | 03 |
| G13 | Admin dashboard counters partial (no Active Vacancies / accepted & placed totals; Reports only has placed); admin accreditation can't "request additional documents"; admin job-approval rows unreachable by design (ADR-000) | `super-admin/Dashboard.jsx`, `Accreditation.jsx` | **Low** | 03 |
| G14 | "Monthly PESO Report" (statutory LGU form) is not built and cannot be designed until someone supplies the official template/format | `to_do.md` §4 | **Low** | blocked in 03 |
| G15 | No monitoring/alerting beyond structured request logs and `/api/health` (which exists and is good) | `server/src/middleware/requestLog.js` | **Low** | 06 |
| G16 | No SEO basics: no meta description, no OG tags (and G1 makes every URL unshareable regardless) | `index.html` | **Low** | 02 |
| G17 | Doc drift: `to_do.md` still lists Shortlisted statuses (removed by migration 004), plan.md Phase-3 says `referred_by` migration needed (column exists), gap-matrix evidence paths predate the `src/features/` rework | `to_do.md:143`, `plan.md:49-51`, gap-matrix header | **Low** | maintained below |

## Decided — do NOT re-propose ( signed-off ADRs / CUT list)

- **Job approval flow stays removed** (ADR-000): direct publish, admin retains
  close/archive; "approved/rejected/awaiting-approval" notifications out of scope.
- **Custom "skills"/"barangays" tables CUT** — `text[]` + reference data satisfy
  filters today.
- **Reports table CUT** — reports are computed; CSV export (9 types, server-side,
  injection-guarded) + `window.print()` cover the need; XLSX/PDF CUT.
- **Data-retention UI CUT** — daily automated `runRetentionPurge()` only.
- **`plan.md` Phase-3 `referred_by` migration stale** — column exists; plan.md is
  a historical artifact.
- **In-process ceilings, accepted with named tradeoffs** (keep their `ponytail:`
  comments, revisit only at scale): 60s JWT-revocation window (ADR-028),
  in-memory rate-limit store, four deliberately unbounded reads (ADR-029),
  audit-log date matching assuming UTC+8 host.
- **i18n CUT** — all copy English; introduce only if an LGU requires Filipino.

## Maintenance tasks (do here, no code)

- [x] Add a stale-premise banner to `to_do.md` pointing at this register and the
      gap-matrix (statuses live there, not in to_do.md).
- [x] Re-stamp `docs/arch/gap-matrix.md` with a "re-verified 2026-11-04" note on
      the already-closed rows: publish fan-out (`notifyMatchingSeekers` exists in
      `server/src/routes/jobs.js`), Shortlisted removed entirely (migration 004),
      admin job edit/publish shipped, invite flow shipped, ADR-001 one-liners
      rechecked (03 has the verify task).
      *(both boxes done 2026-11-09; the gap-matrix re-stamp landed as a new
      "Re-verification (2026-11-09)" section, and ADR-001 one-liners stay with
      plan 03)*

## Row status re-verified 2026-11-09 (read before executing plans 02-06)

Each row below was re-checked against the working tree on 2026-11-09. Rows not
listed are unchanged from the register above.

| ID | Status 2026-11-09 | Evidence / consequence |
|---|---|---|
| G1 | **SUPERSEDED — do not implement plan 02 as written.** The address bar is frozen **by product-owner decision**: ADR-036 "Frozen address bar with working Back/Forward" (Accepted 2026-11-04) **supersedes ADR-035** (real URLs). Implemented in `src/shared/lib/StaticUrlRouter.jsx`, wired at `src/App.jsx:77`; Back/Forward work without URL changes, bookmarkability was knowingly traded away. Bookmarkable URLs need a new ADR first | `docs/arch/adr-036-frozen-url-with-history.md` |
| G5 | **CLOSED** | Two-part backup path documented: `db/README.md` §5 (dump + restore) and `scripts/backup-uploads.mjs` (`npm run backup:uploads`, ADR-040). Remaining nuance: scripted, not scheduled; no recorded restore drill |
| G6 | **PARTIAL** (still open, narrowed) | Evidence harnesses exist: `server/scripts/verify-live.mjs`, `verify-browser.mjs`, `verify-files.mjs`, `docs/arch/testing/` campaign records. Still no real-Postgres test suite (the pool-resilience test exercises the real `pg.Pool` object but connects to nothing) |
| G9 | **CLOSED** | `AiMatchModal` deleted from `src/` (0 grep hits); replaced by the real `/api/ai/job-match` ranking in Browse Jobs |
| G11 | **PARTIAL** | Seekers: `src/features/job-seeker/Profile.jsx` 730 → ~412 lines (split). Not yet: `src/features/employer/JobPosts.jsx` still ~1090 lines; `server/src/routes/admin.js` still ~681 lines with notifications inside (ADR-026 unimplemented) |
| G12 | **PARTIAL** (corrected) | `ApplicantsShell` chain is gone; `SiteHeader`/`SiteFooter`/`AccountMenu` remain with **zero importers outside their own files/tests**; sonner dep still mounted with **zero `toast()` calls**. Correction: `NotificationBell` is **live** (`src/shared/components/TopNavLayout.jsx` imports it) — it is not dead |
| G13 | **PARTIAL** | Admin dashboard now shows an "Active vacancies" tile and placement count (`src/features/super-admin/Dashboard.jsx:54,71,78`). "Request additional documents" and the ADR-000 approval rows remain as described |
| G16 | **CLOSED** | `index.html:9` meta description + `:12,14,17` OG tags present. SEO value beyond that is bounded by the G1 decision |

Open and unchanged: G2 (legal copy), G3 (no server-side permission enforcement; bundles are
validated in `server/src/routes/admin.js` but never checked at request time), G4 (decided by
ADR-037/ADR-038 — single persistent node), G7, G8, G10, G14 (blocked on template), G15, G17.
