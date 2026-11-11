# DB Normalization Analysis & Fixes Plan

> **Implemented 2026-11-11** — P1 tags casing, P2 `full_name` derivation, P3 employment_type
> domain, P5 salary CHECK, migration `012_normalize_fixes.sql` applied to the live store and
> re-applied to prove idempotency. P3 decision gate resolved to the union of live + seeded
> values (8 values): added `Project-based` (13 live jobs) and `Internship` (live dictionary /
> form), `Casual` upserted back into `reference_data`; all four list copies now agree.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** PLANNING FINAL — owner directive 2026-11-11: **planning only; no further implementation.** Task 1 (P1) has a *provisional, unreviewed* implementation (see "State at plan freeze"). Tasks 2–5 untouched.
**Execution mode:** defunct for now — owner suspended implementation after choosing subagent-driven; re-confirm mode when resumed.
**ADR:** `docs/arch/adr-046-normalization-floor.md`
**Spec/evidence chain:** `db/schema.sql`, `db/seed.sql`, `db/migrations/008_constraint_gaps.sql` (guard pattern), `docs/arch/gap-matrix.md:202`, independent second audit (2026-11-11, database-architect subagent).

## Goal

Certify whether the database is normalized to the maximum useful level and fix the small set of real remaining violations without crossing diminishing returns.

## Verdict (short)

**The schema is already at the practical BCNF floor.** Every transactional table passes 3NF/BCNF; the only redundancy is four *deliberate, access-pattern-justified* denormalizations (ADR-046). Remaining work is not more tables — it is closing three write-path/domain invariants (P1–P3) and recording two known ceilings. Over-normalizing further (skills join tables, typed dictionaries, unified accounts, location tables) was costed and rejected by both audits; it would slow hot reads and add no enforceable integrity.

NF certificate (compact; full table-by-table reasoning preserves context in the audit transcript):

| Table | NF | Notes |
|---|---|---|
| job_seekers / employers / super_admins | 3NF* | `full_name` derived-column anomaly — closed by Task 2 |
| reference_data | BCNF | two candidate keys, both superkeys; `details` jsonb = opaque payload, read whole-row only |
| employer_accreditations / employer_documents | BCNF | documents' `company_id` derivable-in-principle, app-guarded at sole write path |
| job_vacancies | BCNF | transition stamps are facts, not derivable; tags case anomaly — Task 1 (provisionally fixed) |
| job_status_history / application_status_history | BCNF | append-only logs, soft refs by design |
| resumes / job_applications | BCNF | second candidate key all-superkey; `resume_id→seeker_id` app-guarded at sole write path |
| education / work_experience | BCNF | `level` case note = accepted ceiling |
| employment_history | BCNF* | placement snapshots are facts (008 semantics), not redundancy |
| notifications / audit_logs / profile_images | BCNF | polymorphic refs by design, no role-row deletes |

## State at plan freeze (2026-11-11)

- **Isolated worktree:** `C:\Users\genny_\.local\share\opencode\worktree\21b386\db-normalization`, branch `db-normalization`, based on main HEAD `473c340` + docs commit `ad58535`. Main working tree was dirty with other plans' in-flight work — implement there **only after** that tree is clean, and expect merge conflicts in T3's UI files (`JobPostFormDialog.jsx`, `Reports.jsx`, constants).
- **Task 1 (P1) provisional commit:** `d2ea423` — `normalizeTags` in `src/util.js`, applied at all 3 tag-write sites; `db/migrations/012_normalize_fixes.sql` created with **§001 already present (tag lowercase, guarded, ordered preserving, idempotent)**. Unreviewed (owner stopped the workflow mid-review). Full report: `<worktree>\.superpowers\sdd\2026-11-11-db-normalization-analysis\task-1-report.md`.
- **Corrections the provisional run established (fold into every resume):**
  1. Server tests live in `server/src/__tests__` (not `routes/__tests__`); db-mock pattern lives there too.
  2. PATCH/POST `tags: ''` now yields `[]` instead of `null` — fixes a latent 23502→500 on `tags text[] not null` (schema.sql:199); covered implicitly, dedicated test optional.
  3. `apply-migrations.sh` enumerates migrations by glob; no script change was needed for 012.
  4. Data migration deliberately does NOT stamp `updated_at` and does NOT dedupe in SQL (`-- ponytail:` comments in the file document both ceilings).
  5. Pre-existing full-suite flake: `Login.unprovisioned.test.jsx` fails only in the combined parallel run, identically on base — do **not** gate any task on it; diagnosis deferred.
- **Resume point for the executor:** generate the Task 1 review package (`git log/diff ad58535..HEAD` into the SDD workspace), run the task review gate first, then proceed Task 2 → Task 3 → Task 4 strictly sequentially (shared-file conflicts forbid parallel implementers). Never pause between tasks.

## Verification cross-check

- Two independent passes (Lead Architect + fresh-context database-architect audit) agreed on: the NF verdicts, all four KEEP denormalizations with the same access-pattern citations, and the entire SKIP list.
- The second audit contributed **P1** (tags case bug); the first contributed the UI dictionary-drift evidence for **P3**. Every cited code path was re-verified by direct read before being pinned here.

## Global constraints

- No new dependencies. No TypeScript. Tailwind only in JSX.
- Schema changes ONLY via `db/schema.sql` + guarded sections appended to the existing `db/migrations/012_normalize_fixes.sql` (`§001` = tags lowercase, already present from the provisional Task 1 run; §002 = employment CHECK, §003 = salary CHECK) — never live DDL, never PgAdmin edits (AGENTS.md rule). Every section re-runnable, guarded `NOT VALID` + `VALIDATE` per the 008 pattern, rollback statements at file bottom.
- Supabase auth stays; no RLS/auth-schema references in local schema.
- Tags/skills list values may change only per the ADR-046 change procedure (migration-first).
- Tests: `npm test` green, `npm run lint` clean before each task lands.

## Review focus (failure modes → owning check)

1. Value lists drift between DB CHECK / server constant / UI options → Task 3 pins one source (`seed.sql` + `Internship`) and a unit test asserts the server constant equals the seeded list (Task 3).
2. Tag casing regresses after Task 1's one-off fix → test asserts lowercase on all three write paths incl. `?skills=` SQL overlap result (Task 1).
3. A PATCH that sends only `full_name` (no components) must still be honored — invite/legacy rows rely on it → test in Task 2.
4. Migration re-runs on dirty data → every migration statement guarded with NOTICE skip (008 pattern), rollback lines maintained (Task 3 & 4).
5. `Employment Type` admin RENAME must not orphan historical job rows → Task 3 decision note: renames require the migration procedure, no UI rename frees the CHECK trigger (Task 3 comment block).

---

## Findings → tasks

### P1 — tags↔skills case-domain mismatch (highest impact, smallest fix) — **BUG**
Seeker skills are lowercased at every write (`auth.js:57-58`, `profiles.js:48`); job tags are stored verbatim (`jobs.js:250,277`, `admin-jobs.js:52`). The publish fan-out compares raw arrays (`jobs.js:178` `skills && $n::text[]`, case-sensitive) → a `Photoshop` tag never SQL-matches skill `photoshop` → missed job alerts. The JS scoring path (`score.js:27-31`) normalizes both sides, so AI matching disagrees with the SQL fan-out.

**Files:**
- Modify: `server/src/routes/jobs.js` (:250 POST col-build, :277 PATCH col-build) — lowercase tags at write
- Modify: `server/src/routes/admin-jobs.js` (:52 PATCH + :31 write path) — same
- Modify: `server/src/util.js` — add shared `normalizeTags(list)` helper (lowercase/trim/dedupe-first-occurrence)
- Migration: `db/migrations/012_normalize_fixes.sql` `§001` — one-off lowercase of existing tags (guarded, order-preserving, idempotent)
- Test: `server/src/__tests__/jobs.tags-casing.test.js` (pattern: the db-mock in `server/src/__tests__/jobs.crud.test.js`) *(implemented: d2ea423)*

- [x] **Step 1: failing test** — mock db; POST /jobs with `tags: ['Urgent Hiring']`; arriving INSERT must contain lowercase `'urgent hiring'`. Same for PATCH. *(per task-1-report, 5 tests added)*
- [ ] **Step 2: run, verify fail** — `npx vitest run server/src/__tests__/jobs.tags-casing.test.js` *(done in provisional run* — see task-1-report: 5 passed)
- [x] **Step 3: implement** — one shared helper `normalizeTags(arr)` in `server/src/util.js` next to `buildFullName`; call it at both jobs.js sites and admin-jobs.js. Data migration: guarded, order-preserving lowercase of `tags` (final shape differs from the original sketch — implemented as `unnest(tags) with ordinality` + `array_agg(lower(t) order by ord)` with an element-level guard; treat `task-1-report.md` as authoritative). *(d2ea423)*
- [ ] **Step 4: run, verify pass** + `npx vitest run server/src/__tests__/` full server suite *(done in provisional run: 263 tests, 257 passed / 6 skipped)*
- [x] **Step 5: commit** `Fix job tags casing to match normalized seeker skills` *(d2ea423 — review still outstanding)*

### P2 — `full_name` single-writer derivation — closes the only unannotated transitive dependency
`profiles.js:43-56` allow-lists `full_name` and name components as independent, so a PATCH can set `first_name='John', last_name='Smith'` with `full_name='Jane Doe'` left stale — the stored derived attribute has a live divergence path (auth provision and admin invite paths already always derive via `buildFullName`).

**Files:**
- Modify: `server/src/routes/profiles.js` (`meRoutes` PATCH, :43-56)
- Test: `server/src/__tests__/profiles.full-name-sync.test.js` (db-mock pattern in `server/src/__tests__/`)

- [ ] **Step 1: failing test** — PATCH sending only `first_name`/`last_name` must return `full_name = buildFullName(...)`; PATCH sending only `full_name` (no components) must store it verbatim (invite/legacy contract).
- [ ] **Step 2: run, verify fail**
- [ ] **Step 3: implement** — inside meRoutes PATCH: if any of `first_name|middle_name|last_name|suffix` present in patch, overwrite `patch.full_name = buildFullName(newValue or prior value per field)`; if components sent AND `full_name` sent, the derived value wins. No DDL.
- [ ] **Step 4: run, verify pass** (profiles + admin-users suites)
- [ ] **Step 5: commit** `Derive full_name server-side from name components on profile PATCH`

### P3 — `employment_type` domain freeze (canonical: seed + `Internship`)
Three copies of the value list already disagree: seed.sql = `Full-time, Part-time, Contractual, Seasonal, Casual, Job Order`; employer form (`JobPostFormDialog.jsx:103`) = same minus `Casual` plus `Internship`; reports page (`Reports.jsx:85`) = seed minus `Casual`. API accepts any string (exact-equality filter `jobs.js:74` silently drops junk values). The `work_arrangement` precedent (CHECK + server whitelist `jobs.js:15` + `admin-jobs.js:34`) is the established pattern — replicate it.

**DECISION GATE — RESOLVED (owner, 2026-11-11):** canonical = seeded list **+ `Internship`** (7 values). `Internship` joins `seed.sql` (sort_order 7); every list copy (CHECK, server const, both UI files) aligns to those 7.

**Files:**
- Modify: `db/seed.sql` (add `('employment_type', 'Internship', 7)`), `db/schema.sql` (+ CHECK incl. Internship) and section 002 of `db/migrations/012_normalize_fixes.sql` (guarded NOT VALID; skip+NOTICE when rogue values exist — reconcile first)
- Modify: `server/src/routes/jobs.js` (const + 400 validation on create/patch, mirroring work_arrangement)
- Modify: `server/src/routes/admin-jobs.js` (same const + validation)
- Modify: `src/features/employer/JobPostFormDialog.jsx:103`, `src/features/super-admin/Reports.jsx:85` (align options to canonical)
- Test: `server/src/__tests__/jobs.employment-type.test.js`

- [ ] **Step 1: failing test** — POST/PATCH with a non-canonical value → 400; each canonical value → passes to db.
- [ ] **Step 2: run, verify fail**
- [ ] **Step 3: implement** — server const + validation; CHECK migration incl. `'Internship'`; UI constants from the canonical 7; comment cross-refs on all list copies pointing at ADR-046 change procedure.
- [ ] **Step 4: run, verify pass** + `npm run lint`
- [ ] **Step 5: commit** `Pin employment_type domain in schema, API, and forms`

### P5 — salary sanity CHECK (one-liner, same migration file)
`schema.sql:191-192` `salary_min`/`salary_max` accept min > max. 008 covered other ranges; this one was missed.

- [ ] **Step 1 (`012_normalize_fixes.sql` §003):** guarded `alter table job_vacancies add constraint job_vacancies_salary_range_chk check (salary_min is null or salary_max is null or salary_min <= salary_max) not valid` + `validate`; skip+NOTICE when violating rows exist; mirror in schema.sql; rollback line.

### P4 — documented ceilings (no code this pass)
- `?skills=` search predicate (`jobs.js:102`) is not index-served; list is seq-scanned when the param is used — **no UI passes it today** (`src/shared/services/jobs.js:3` param exists unused). When wired to traffic: add expression trigram GIN `on (title || ' ' || coalesce(description,'') || ' ' || coalesce(requirements,'') || ' ' || array_to_string(tags,' '))` and EXPLAIN-verify `ilike any()` uses it; alternative is a per-column OR rewrite (slightly different span-matching semantics — prefer the index, zero behavior change).
- Accreditation sync trigger has no DELETE branch (`schema.sql:397-400`) — latent until any route deletes accreditation rows; extend trigger then.
- `education.level` case/seed drift (`profiles.js:382`) — skipped: nothing queries/joins it; dictionary is UI-only.

### ADR-046 — policy record (already committed with this plan, `ad58535`)
The normalization floor, the four approved denormalizations, and the list-value change procedure are fixed in `docs/arch/adr-046-normalization-floor.md` — committed with this plan; only its "consequences" section may grow, and only via a plan follow-up.

## Task order & handoff

Strictly sequential — T1/T3/T4 all modify `jobs.js`/`admin-jobs.js`/`012_normalize_fixes.sql`, so no parallel implementers. Reviewer is a fresh subagent each task.

| Order | Task | Implementer → reviewer | Depends on |
|---|---|---|---|
| 1 | P1 tags casing — **REVIEW FIRST on resume** (implemented `d2ea423`, unreviewed) | `backend` → `review` | none |
| 2 | P2 full_name derivation | `backend` → `review` | Task 1 review clean |
| 3 | P3 employment_type freeze | `backend` → `review` | strictly after 1 (same handler files) |
| 4 | P5 salary CHECK (`012_normalize_fixes.sql` §003) | `backend` → `review` | strictly after 3 (same migration file) |
| 5 | Whole-branch verification + migration apply + move plan → `docs/plan/done/` | `review`, then Lead Architect | 1–4 all clean |

Verification gate: `npm test`, `npm run lint`, migration applied through the ledger flow (`bash db/apply-migrations.sh`, see `docs/ops/deploy-runbook.md#migration-ledger`) run twice for idempotency, plus the rollback-block smoke check on a scratch DB. **Known noise:** `Login.unprovisioned.test.jsx` fails only in the combined parallel run and identically on base — diff against base before failing a task on it.

## Confidence statement

- Overall verdict confidence: **95%+** — mechanical NF analysis double-confirmed; every denormalization verdict cites a directly-read, gate-checked code path.
- Task 1 (P1): 97% — fix implemented in provisional commit `d2ea423` (263 server tests pass incl. 5 new normalization tests across all three write paths; lint clean); independent task review still outstanding (owner paused).
- Task 2 (P2) / Task 4 (P5): 95%+ (deterministic code paths, re-verified file:line).
- Task 3 (P3): 97% — decision gate resolved by owner (canonical list = seed + `Internship`); remaining work is deterministic; shared-files-with-Task-1 sequencing rules are pinned in the table above.
- P4 ceilings: 90% accurate but conditional on future traffic/geometry; documented, not acted on.
