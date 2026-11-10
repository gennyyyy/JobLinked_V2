# Master Roadmap — PESO JobLinked (index of 2026-11-04 plans)

**For agentic workers:** every plan in this folder is implemented only AFTER the Lead
Architect signs off on it (and any ADR it names). Then use the
superpowers:subagent-driven-development skill to execute task-by-task, one plan at a time.
Execution method selection is still pending with the user.

## Plan set (2026-11-04)

| # | Plan | Purpose | Owner agent |
|---|---|---|---|
| 01 | `2026-11-04-01-system-gap-analysis.md` | Evidence-based "what's lacking / what to improve" register; feeds every other plan; lists decided-CUT items that must not be re-proposed | Lead Architect |
| 02 | `2026-11-04-02-routing-seo-plan.md` | MemoryRouter → real URLs (deep links, back button, page titles/meta). Structural, touches every route | frontend |
| 03 | `done/2026-11-04-03-code-health-plan.md` | Dead component deletion, sonner/duplicate-toast removal, JobPosts.jsx/Profile.jsx/admin.js decomposition, dark mode decision | frontend + backend |
| 04 | `done/2026-11-04-04-security-compliance-plan.md` | Custom-role permission enforcement decision (ADR), real Privacy Policy / Terms (RA 10173), CSP/dependency-audit housekeeping | backend + security |
| 05 | `done/2026-11-04-05-testing-plan.md` | Testing strategy: coverage baseline, real-Postgres integration slice, browser smoke E2E, untested server areas | test-engineer |
| 06 | `done/2026-11-04-06-ops-deployment-plan.md` | Production API topology decision (ADR), migration ledger + apply order, backups + restore drill, minimal monitoring | devops-engineer |

Companion already present (completed): `docs/plan/done/2026-11-04-frontend-performance-and-loading-plan.md`.

## Status check (2026-11-10)

Implemented and archived in `docs/plan/done/`: the design migration, frontend
performance, ponytail cleanup, super-admin invite, AI job matching, role-aware help,
dark mode (implemented, then retired), code health, security/compliance, testing,
ops/deployment, and captcha (renumbered ADR-041).

| Plan | Status |
|---|---|
| 01 system gap analysis | reference register — **closed out 2026-11-10** (see its close-out table) |
| 02 routing/SEO | **superseded by ADR-036** — do not execute; SEO basics shipped |
| 03 code health | **done** — archived |
| 04 security/compliance | **done** — archived; dependency advisories remain open by design (CI is advisory) |
| 05 testing | **done** — archived; real-Postgres suite, browser smoke, CI service |
| 06 ops | **done** — archived; runbook, migration ledger, backups, restore drill passed |
| full-system test fixes | **done** — archived; push performed, draft PNGs kept by owner decision |
| captcha integration | **done** — archived as ADR-041; Supabase dashboard enablement remains a manual ops step |


Completed companion (archived): `done/2026-11-04-full-system-test-fixes-plan.md` —
the live full-system pass (2026-11-04) closed the CORS lock-out, the
unprovisioned-account dead end, the provisioned fixture, and the repo-hygiene
items (push done 2026-11-10; draft PNGs kept by owner decision 2026-11-10).

## Recommended order and dependencies

```
02 routing ──► 03 code health ──► 04 security/compliance ──► 06 ops
     │                                   (ADR-035, ADR-036...)  (ADR-037)
     └── 05 testing can run in any slot; do it after 03 to avoid
         writing tests for code that is about to be deleted.
```

- **full-system-test-fixes first** (it is live-measured, small, and unblocks
  both the load fixture and the smoke script), then
  **02 routing**: routing is the only plan whose changes ripple through every
  page and route test; nothing feature-level should start mid-that.
- **03 deletes dead code** — running 05 before it risks writing tests for code
  that is about to be deleted.
- **04 and 06 gate on ADR decisions**, not on each other. Both include
  items that are blocked on stakeholder input (legal copy, report template).
- Schema changes needed by any plan go through `db/schema.sql` /
  `db/migrations/010+` only with explicit Lead Architect approval (per AGENTS.md
  and the repo rules). Current known need: possibly one new enum value if
  accreditation "request additional documents" is wired (03, Phase A).

## Cross-cutting status conventions

- Each plan carries checkbox tasks; when a phase completes, append a short
  "## Results" section to that plan with the measured before/after, mirroring
  the style of the frontend-performance plan.
- Update `docs/arch/gap-matrix.md` only at close-out of a plan (it is the
  requirements tracker, 2026-10-16 vintage, partly stale — 01 says how).
- ADR numbers: next free is **035** (000–013, 020–034 taken across
  `docs/arch/adr-0NN-*.md` and the backlog). Mint exactly one ADR per plan
  where it names one; do not renumber.

## Explicit decisions requested from the user (blockers)

Resolved: 1 → frozen URL (ADR-036); 3 → dark mode implemented then retired (plan 03/10-18
archive); 4 → AiMatchModal deleted, real `/api/ai/job-match` shipped; 5 → single persistent
node (ADR-037/038).

All six decision items are now settled:

1. ~~Custom-role permissions enforce vs. document~~ → **enforced** (ADR-042): a custom role is
   an allow-list for the super-admin API, keyed per route group; an account without a custom
   role keeps full access as the break-glass path. **Needs one human follow-up:** keep at least
   one bundle-less super-admin, and note the lockout path in the ops runbook.
2. ~~Real legal copy for /privacy + /terms~~ → **drafted** (`src/shared/content/legal.js`:
   `PRIVACY_NOTICE`, `TERMS_OF_USE`, consent modal reuses the notice). **Needs counsel/PESO
   approval of the wording before production** — a review step, not missing code.
3. ~~Monitoring/alerting target~~ → **built** (ADR-043): in-process counters, token-gated
   `GET /api/metrics`, optional per-minute 5xx webhook. **Ops follow-up:** set `METRICS_TOKEN`
   and `ALERT_WEBHOOK_URL` on the host and point a scraper at it.

The one genuinely blocked item is **G14** (statutory Monthly PESO Report), which cannot be
built until someone supplies the official LGU form/template.

## Latest status pass (2026-11-10, end of plan set)

Plan 01 carries the full re-verification table and a close-out summary. Everything in the
2026-11-04 plan set is implemented and archived; the register's remaining "open" rows were
closed today — G3 (ADR-042 permission enforcement), G11 (last monolith: `employer/JobPosts.jsx`
1172 → 585 lines + three modules), G15 (ADR-043 monitoring), G2 (legal copy drafted, pending
review). G14 stays blocked on the external template.

Nothing here proposes moving off JavaScript/JSX, off Supabase Auth, or off the
Express–Postgres topology that ADR-020 signed off.
