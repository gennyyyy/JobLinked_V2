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
| 03 | `2026-11-04-03-code-health-plan.md` | Dead component deletion, sonner/duplicate-toast removal, JobPosts.jsx/Profile.jsx/admin.js decomposition, dark mode decision | frontend + backend |
| 04 | `2026-11-04-04-security-compliance-plan.md` | Custom-role permission enforcement decision (ADR), real Privacy Policy / Terms (RA 10173), CSP/dependency-audit housekeeping | backend + security |
| 05 | `2026-11-04-05-testing-plan.md` | Testing strategy: coverage baseline, real-Postgres integration slice, browser smoke E2E, untested server areas | test-engineer |
| 06 | `2026-11-04-06-ops-deployment-plan.md` | Production API topology decision (ADR), migration ledger + apply order, backups + restore drill, minimal monitoring | devops-engineer |

Companion already present (completed): `docs/plan/done/2026-11-04-frontend-performance-and-loading-plan.md`.

## Status check (2026-11-09)

Implemented and archived in `docs/plan/done/`: the design migration, frontend
performance, ponytail cleanup, super-admin invite, AI job matching, role-aware help,
and dark mode (implemented, then retired by the design migration).

| Plan | Status |
|---|---|
| 01 system gap analysis | reference register — keep |
| 02 routing/SEO | **superseded by ADR-036** — do not execute |
| 03 code health | **partial** — deletions, sonner/dark-mode removal, admin split, admin seeker dialog done; employer resume action, ADR-001 book-close, optional counters, split-on-touch notes open |
| 04 security/compliance | **partial** — ADR-036 and legal copy done; CSP review, CI dependency audit, secrets-hygiene record open |
| 05 testing | **not started** — no real-Postgres slice, no browser E2E |
| 06 ops | **partial** — ADR-037 done; deploy runbook, migration ledger, backups, restore drill, monitoring open |
| full-system test fixes | code fixes done; 3 owner-gated hygiene items open |
| captcha integration | **not started** — ADR-040 number conflicts with `adr-040-profile-images-and-file-backups.md` |


Also present and IN SCOPE today: `2026-11-04-full-system-test-fixes-plan.md` —
a live full-system pass (2026-11-04) with four measured findings: CORS
preview/prod lock-out, unprovisioned-account dead end, missing provisioned test
fixture, repo hygiene (unpushed commits, scratch files). It is the most
evidence-backed plan in the folder — **execute it first** (it also lands the
smoke script that Plan 05's Phase 3 extends, and unblocks the load fixture the
Plan 06 topology decision should assume exists).

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

1. Router swap approval (02) — changes URL behavior everywhere.
2. Custom-role permissions: enforce vs. document (04) — ADR-036.
3. Dark mode: implement per the 2026-10-18 spec or delete the dormant tokens (03).
4. AI-match modal: wire to the existing `/api/ai/help` or cut the button (03).
5. Production API host: persistent Node (recommended) vs. serverless rework (06) — ADR-037.
6. Real legal copy for /privacy + /terms (04) — text must be supplied.

Nothing here proposes moving off JavaScript/JSX, off Supabase Auth, or off the
Express–Postgres topology that ADR-020 signed off.
