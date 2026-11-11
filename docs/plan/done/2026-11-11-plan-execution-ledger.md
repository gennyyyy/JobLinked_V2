# Execution plan — all pending `docs/plan/` work (2026-11-11)

**Status:** SIGNED OFF — Lead Architect, 2026-11-11.
**Purpose:** drive every pending plan in `docs/plan/` to implemented + verified, then archive it under `docs/plan/done/`.

## Pending-plan audit (verified against the working tree before any code)

| Plan | State found | Action |
|---|---|---|
| `2026-11-11-native-scroll-parallax.md` | not implemented (no `parallax` utility; hero inline bg) | implement, archive |
| `2026-11-11-db-normalization-analysis.md` | not implemented (no `normalizeTags`, no employment-type CHECK, no migration 012) | implement, archive |
| `2026-11-11-prohibited-fee-filter.md` | not implemented (no detector, no `job_prohibited_flags`) | implement, archive |
| `2026-11-11-resume-autofill-accuracy.md` | not implemented (no `/ai/resume-extract`, no eval harness, no touched/consent) | implement, archive (accuracy table marked as blocked external input) |
| `2026-11-04-00-master-roadmap.md` | reference index; every referenced plan done | archive as closed |
| `2026-11-04-01-system-gap-analysis.md` | reference register; closed out 2026-11-10 | archive as closed |
| `2026-11-04-02-routing-seo-plan.md` | SUPERSEDED by ADR-036; must not execute | archive as superseded |
| `design-analysis.md` | migration complete (ThemeToggle/ThemeProvider/sonner gone; Toast/ConfirmationModal still in use by design) | archive as complete |

## Architecture decisions taken for this pass

1. **Migration numbering reconciled.** Both 2026-11-11 plans claimed `012`. Final:
   `db/migrations/012_normalize_fixes.sql` (normalization: tags data fix, `employment_type`
   CHECK, salary-range CHECK, reference-data row) and
   `db/migrations/013_job_prohibited_flags.sql` (fee-filter table + indexes).
2. **ADR numbering reconciled.** `adr-045-*` is already used twice (parallax, resume autofill)
   and `adr-046` is the normalization floor. The fee-filter ADR is therefore
   `docs/arch/adr-047-prohibited-fee-filter.md`. No existing ADR is renumbered.
3. **`employment_type` canonical list (P3 decision gate, resolved).** Live data in the
   remote store uses `Full-time`, `Part-time`, `Contractual`, `Project-based`; the seeded
   DOLE/PESO list also carries `Seasonal`, `Casual`, `Job Order`. Canonical list =
   `['Full-time','Part-time','Contractual','Seasonal','Casual','Job Order','Project-based']`.
   `Project-based` is added because 13 live rows use it (data-driven); `Internship` is dropped
   from the employer form because no row uses it and it is not a PH employment-type taxonomy
   member. All four list copies (DB CHECK, seed, server constant, UI) must agree.
4. **Resume-extract over-long input** answers `400 INVALID_INPUT` (the plan's API block lists
   a 413, but its Task 4 tests and Review Focus both say 400; the tests win — one contract).
5. **Resume-extract provider call keeps `callChat` unchanged**; the reply is parsed as JSON
   (fences tolerated) then schema-validated. No new dependency, no provider-layer change.
   `response_format: json_object` is an optimisation, not required for correctness.
6. **Eval corpus uses `.txt` golden fixtures + the plan's existing real PDF/DOCX samples**
   rather than hand-generating synthetic PDF/DOCX binaries (no PDF writer dependency; the
   unit under test is text→fields, and the existing `sample_pdf/` files cover extraction).
   `resumeAutofill.js`'s extensionless `./phone` import gains `.js` so the Node eval script
   can import the module (Vite accepts both).
7. **Fee-filter terms are data.** Hard block = unambiguous collection phrases; softer fee
   words (including `fee`, `payment`, `bayad`) hold for human review, because the plan
   explicitly accepts "no fees are collected" being held-and-cleared. Tagalog terms hold.
8. **No new dependencies anywhere.** No `db/schema.sql` change without this sign-off —
   both migrations are approved and mirrored into `schema.sql` for fresh installs.

## Work packages → agents

| WP | Plan | Agent | Files (owner) |
|---|---|---|---|
| A | parallax | `frontend` | `src/index.css`, `HomeHero.jsx`, `CommunitySections.jsx`, new test |
| B | DB normalization | `backend` | `server/src/{util,jobs,admin-jobs,profiles}.js`, `db/schema.sql`, `db/seed.sql`, `db/migrations/012_*`, employer form + Reports + constants, tests |
| C | resume autofill server + eval | `backend` | `server/src/ai/resumeExtract.*`, `server/src/routes/ai.js`, `scripts/eval-autofill.mjs`, corpus, `package.json`, `.github/workflows/ci.yml` |
| D | resume autofill client | `frontend` | `useResumeAutofill.js`, `resumeAutofill.js`, `JobSeekerPersonalStep.jsx`, tests |
| E | fee filter (full stack) | `backend` + `frontend` review | `db/migrations/013_*`, `schema.sql`, `server/src/services/jobFeeFilter.*`, `jobs.js`, `admin-jobs.js`, employer/super-admin surfaces, service + tests |

Sequencing: A ∥ B ∥ C, then D (needs C's corpus) and E (needs B's edits to `jobs.js`).

## Verification gate (every WP, then whole repo)

- `npm test` (client) green; `npm --prefix server test` green; `npm run lint` clean.
- Migrations applied through `db/apply-migrations.sh` (psql 18 at `C:\Program Files\PostgreSQL\18\bin`),
  run twice to prove they are re-runnable; remote store probed after.
- Fee filter: blocked post writes nothing; held post is invisible to seekers (`pending`),
  flag row + notification exist; admin approve publishes and resolves the flag.
- Parallax: structure smoke test + CSS-only diff; reduced-motion/reduced-support fallbacks static.
- Resume autofill: consent-off unchanged; consent-on merges LLM fields; provider-down falls back;
  endpoint validation + prompt-injection tests green; eval harness prints per-field table.
- Archive each plan only after its gate passes.

## Known external inputs (not code)


- `OPENROUTER_API_KEY` is not set in `server/.env`, so the plan's LLM-accuracy table cannot be
  measured here. All endpoint/fallback behaviour is verified with mocks; the ADR accuracy gate
  stays open until a key is present.
- The 10–20 real anonymized Filipino resumes (owner input) remain an optional corpus grow-out.
- G14 (statutory Monthly PESO Report) remains blocked on the official template, unchanged.

## Final results (2026-11-11)

| WP | Plan | Result |
|---|---|---|
| A | parallax | implemented, structure test green, CSS verified in build |
| B | DB normalization | P1/P2/P3/P5 shipped; migration 012 applied twice; 8-value canonical list |
| C | resume autofill server/eval | endpoint + limiter + harness + corpus; heuristic baseline 100% on 10/13 fields |
| D | resume autofill client | consent gate, touched labels, merge; 100% on 10/13; 3 undelimitable address fields left blank |
| E | fee filter | migration 013 + detector + routes + admin/employer surfaces; server + client tests green |

Verification: client `npm test` 1185 passed / 6 skipped (192 files); server
`npm test` 606 passed / 6 skipped; `npm run lint` clean; `npm run build` green;
`npm run eval:autofill` table above; migrations 012/013 applied and re-run
idempotently; ledger records 012 + 013 with no pending.

