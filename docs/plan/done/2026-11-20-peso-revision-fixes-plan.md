# PESO Revision Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings 2–5 of `docs/plan/2026-11-20-peso-revision-verification.md`: one terminology for matching, one controlled field/skill vocabulary shared by employers and seekers, field/skill tags displayed separately from work arrangement, and matching/accreditation/tracking centered on Home and Browse Jobs.

**Architecture:** Two new vocabularies (`job_field`, `skill`) live in the existing `reference_data` table and are served by one small public endpoint; both sides pick from the same list. Structured columns (`job_vacancies.field`, `job_vacancies.skills`, `job_seekers.field`) make the existing matching engine score real skills instead of posting-attribute tags. UI work is display/layout only — no new state library, no new dependency.

**Tech Stack:** React 19 JSX, Tailwind v4, Express 4 + pg, PostgreSQL 18, Vitest 4 + RTL. No new dependencies.

**Spec:** the verification report above plus this plan's Decisions. Root-cause evidence is inline (file:line). Related: `docs/arch/tech-stack.md`, ADR-042 (reference-data pattern), `docs/plan/2026-11-19-supabase-to-better-auth-plan.md` (independent; its migration 016 claim is noted in Global Constraints).

## Global Constraints

- **No new dependencies.** Vocabularies come from `reference_data` + the existing API client.
- **Schema:** additive only, through `db/schema.sql` + `db/migrations/016_job_field_and_skills.sql`, applied with `db/apply-migrations.sh`. The Lead Architect signs off on the DDL in Task 1 with this plan. No column drops, no destructive rewrite of existing `tags` or `skills`.
- **Migration number:** this plan owns `016`. The Better Auth plan was moved to `017` accordingly (the ledger applies in filename order).
- **API calls through `src/shared/lib/api.js`** only.
- **No data loss:** every distinct existing seeker skill is backfilled into the `skill` vocabulary before any validation rejects unknown values (Task 1).
- **Work arrangement stays exactly as is** (enum + separate control); it is not a tag and must not be merged into the vocabulary.
- **Tests/commands before each commit:** `npm test`, `npm --prefix server test`, `npm run lint`; plus `npm run build` for UI tasks.
- **External, out of repo:** finding 2's paper/defense wording and finding 6 (PESO needs analysis citation) cannot be fixed in code; canonical sentences are provided in the Appendix for the owner to paste.

## Review Focus (failure modes no single task's test covers)

1. **Legacy rows with no new columns** — pre-migration vacancies have `field = null`, `skills = '{}'`; cards, filters, detail pages, and matching must render and score without crashing or inventing a 0% badge. Expected: no Field badge, "skills overlap" hidden when the vacancy lists no skills.
2. **Skills casing round-trip** — `profiles.js:56` lowercases every skill on write while the controlled list carries proper case. Expected: canonical casing is stored and rendered; validation compares case-insensitively.
3. **Legacy free-text skills** — a seeker with "MS Excel" must keep it after the vocabulary backfill and see it selected in the picker. Expected: zero rows lose skills.
4. **Vocabulary endpoint scope** — the new public GET must serve only `job_field` and `skill`; `custom_role` rows (permission bundles) must never be readable without admin auth. Expected: 404/400 for every other category.
5. **Collapsed filters remain usable** — the Browse Jobs restructure hides filters behind a disclosure; keyboard users must still reach every control, with labels, and the matching panel's status must stay `aria-live`. Expected: axe-clean and keyboard-navigable.

---

## Decisions

1. **Terminology (finding 2): "skills-based matching"; AI is an optional assist, never the product name.** Code truth: `server/src/matching/score.js` always produces a deterministic ranking (skills 55%, barangay 20%, position 10%, recency 15%); `server/src/routes/aiMatch.js` only re-ranks the top 30 when a provider is configured. Canonical copy is in the Appendix; the same sentences go to the paper/defense. Owner must confirm the wording before Task 9 — it is the only decision here that is not purely technical.
2. **Controlled lists (finding 3): `reference_data` categories `job_field` and `skill`.** One source of truth, managed by the existing admin reference UI; a public read-only endpoint serves them; both employer and seeker pickers consume it. `JOB_TAGS` stays in `src/shared/constants.js` but is re-labelled **"Highlights"** — they are posting attributes (Urgent Hiring, Day Shift), not fields or skills.
3. **Data model (finding 4):** `job_vacancies.field text`, `job_vacancies.skills text[]`, `job_seekers.field text`. `job_vacancies.tags` keeps its meaning (highlights). Skills become a real join-free array on both sides, GIN-indexed on vacancies.
4. **`categoryLabel`'s tag fallback is removed (root-cause fix):** the Browse Jobs "Job category" filter currently lists `tags[0]` values (`jobDisplay.js:45`), i.e. "Urgent Hiring" as a category. It becomes the vacancy's `field`, with legacy fallback to `office`.
5. **Matching reads structured skills:** `score.js` scores seeker skills against `job.skills`; `notifyMatchingSeekers` (`jobs.js:204-211`) notifies on `skills && job.skills` or same `field`; the AI payload carries `field`/`skills` instead of relying on tags.
6. **Findings 1 and 6 need no code.** 1 is PASS; 6 is an external citation (Appendix).

## Schema (approved with this plan)

```sql
-- 016_job_field_and_skills.sql (additive; ledger-applied)
alter table public.job_vacancies add column if not exists field  text;
alter table public.job_vacancies add column if not exists skills text[] not null default '{}';
alter table public.job_seekers  add column if not exists field  text;
create index if not exists job_vacancies_skills_gin on public.job_vacancies using gin (skills);
create index if not exists job_vacancies_field_idx  on public.job_vacancies (field);

-- No skill is lost: every distinct existing value becomes a vocabulary entry.
insert into public.reference_data (category, value, sort_order)
select 'skill', s, 1000 + row_number() over (order by s)
from (select distinct trim(lower(skill)) s
      from public.job_seekers, unnest(skills) as skill
      where trim(skill) <> '') existing
on conflict (category, value) do nothing;
```

Seeded vocabulary (Task 1; adjust values with the PESO office, keep ~15 fields / ~60 skills): `job_field` — Administrative & Office, Sales & Retail, Food & Beverage, Production & Manufacturing, Construction, Logistics & Delivery, Customer Service, Healthcare, Education, Information Technology, Finance & Accounting, Human Resources, Engineering, Maintenance & Repair, Security Services. `skill` — starter set covering the seeded vacancies plus common local roles (e.g. Customer Service, Cashiering, Inventory, MS Excel, Data Entry, Welding, Electrical Wiring, Driving, Food Preparation, Housekeeping, Sales, Communication, Teamwork, …).

---

### Task 1: Vocabulary + columns + backfill

**Files:**
- Create: `db/migrations/016_job_field_and_skills.sql`
- Modify: `db/schema.sql` (mirror DDL + seed note), `db/seed.sql` (vocabulary rows), `db/seed-dev.sql` (fixture jobs get `field`/`skills`)
- Test: `db/migrations/016_job_field_and_skills.test.js` (following `002_acid_gaps.test.js` style)

**Interfaces:**
- Produces: reference categories `job_field`, `skill`; columns per Schema block.

- [ ] **Step 1: Write the failing test** — applies the migration to a scratch DB; asserts the three columns exist, the GIN index exists, vocabulary categories are non-empty, and a pre-existing seeker skill ("MS Excel") appears in `reference_data(category='skill')` exactly once after a second apply (idempotent insert).
- [ ] **Step 2:** Run it → FAIL (migration missing).
- [ ] **Step 3:** Write the migration + seed + schema mirror + fixtures per the Schema block.
- [ ] **Step 4:** `DATABASE_URL=<scratch> ./db/apply-migrations.sh --status` → pending: 016; apply; re-run → `nothing to apply`. Test → PASS.
- [ ] **Step 5:** Commit `db: job field/skill columns + controlled vocabularies`.

### Task 2: Public vocabulary endpoint + client service

**Files:**
- Create: `server/src/routes/reference.js`, `server/src/routes/reference.test.js`, `src/shared/services/reference.js`, `src/shared/services/__tests__/reference.test.js`
- Modify: `server/src/app.js` (mount `referenceRoutes`)

**Interfaces:**
- `GET /api/reference/:category` → `200 { values: string[] }` for `category ∈ {job_field, skill}`; `400 UNKNOWN_CATEGORY` otherwise (explicit allowlist; never `custom_role`).
- Client: `getReferenceValues(category)` → `string[]` (10 s GET cache already applies).
- Later tasks import only these two names.

- [ ] **Step 1: Write failing tests** — allowlisted category returns seeded values in `sort_order`; `custom_role` → 400; unknown → 400; no auth required; client service unwraps and caches.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (one SQL query; no `select *`). **Step 4:** PASS. **Step 5:** Commit `feat: public job_field/skill vocabulary endpoint`.

### Task 3: Job posting contract (server)

**Files:**
- Modify: `server/src/routes/jobs.js` (JOB_COLS, validation, duplicate, `notifyMatchingSeekers`), `server/src/routes/admin-jobs.js` (ADMIN_JOB_COLS), `src/shared/services/jobs.js` only if create/patch payload shapes are documented there
- Test: `server/src/routes/jobs.skills.test.js` (new), `jobs.create.test.js`, `jobs.duplicate.test.js`, `admin.jobs.*` fixtures

**Interfaces:**
- Create/PATCH accept `field: string|null` and `skills: string[]`. `field` is optional server-side (legacy rows stay valid); the employer form requires it for **new** postings.
- Validation: `field` must equal a `job_field` value (case-insensitive, store canonical); every `skills` entry must equal a `skill` value (case-insensitive, store canonical); unknown → `400 BAD_REQUEST` naming the offending value; `skills` capped at 20.
- `notifyMatchingSeekers(job)` matches `skills && job.skills` **or** `field = job.field` (location OR retained).

- [ ] **Step 1: Write failing tests** — create with field+skills round-trips canonical casing; unknown field/skill 400s; PATCH rejects a non-vocabulary skill; duplicate copies both columns; notification fan-out fires for a same-field seeker with no skill overlap.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (one `normalizeVocabulary` helper inside `util.js`, pure and unit-tested there if it grows). **Step 4:** PASS + full server suite. **Step 5:** Commit `feat(server): structured job field/skills with vocabulary validation`.

### Task 4: Seeker profile + registration contract

**Files:**
- Modify: `server/src/routes/profiles.js` (EDITABLE gains `field`; skills validation/canonical casing), `server/src/routes/profiles.patch.test.js`, `server/src/features/auth/jobSeekerRegistration.js` (payload)
- Test: `server/src/routes/profiles.skills.test.js` (new)

**Interfaces:**
- PATCH `/profiles` (or existing profile route) accepts `field` (job_field value or null) and `skills` (≤ 20, vocabulary values). Store canonical case; compare case-insensitively against the vocabulary; keep already-vocabulary legacy values (backfilled in Task 1) valid.
- Registration payload carries the same two fields.

- [ ] **Step 1: Write failing tests** — "ms excel" saves as "MS Excel"; unknown skill 400s with the value named; `field` not in `job_field` 400s; legacy backfilled values still save; over-20 400s.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(server): seeker field + canonical skills`.

### Task 5: Matching engine + AI payload

**Files:**
- Modify: `server/src/matching/score.js` (skills vs `job.skills`), `server/src/routes/aiMatch.js` (`publicJob` gains `field`/`skills`, drops nothing else), `src/shared/utils/jobDisplay.js` (`matchJob`, `preferenceScore`, `categoryLabel`), tests: `server/src/matching/score.test.js`, `server/src/routes/aiMatch.test.js`, `src/shared/utils/__tests__/jobDisplay.test.js`

**Interfaces:**
- `matchJob(job, user)` → `{ score, matched, total }` where `total = job.skills.length` and `matched` is the case-insensitive intersection; when `job.skills` is empty, fall back to the existing text heuristic so legacy vacancies still show a value.
- `categoryLabel(job)` → `job.field || job.office || job.employment_type || ''` (no tags).
- `rankPool` weights unchanged; only the skills source changes.

- [ ] **Step 1: Write failing tests** — skills weight uses `job.skills` (a job whose `tags` contain a skill but `skills` does not scores 0 on skills); empty `skills` yields the fallback score, never divide-by-zero; AI payload includes `field` and `skills` and still excludes seeker PII; `categoryLabel` ignores tags.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS (server + client). **Step 5:** Commit `fix(matching): score structured skills, not posting tags`.

### Task 6: Shared vocabulary pickers

**Files:**
- Create: `src/shared/components/VocabularyPicker.jsx` (label, values, selected, onChange, max, help) — multi-select chips fed by `getReferenceValues`; single-select variant for Field
- Modify: `src/components/ui/` untouched; `src/shared/hooks/` add `useVocabulary(category)` (fetch once, module-level cache)
- Test: `src/shared/components/__tests__/VocabularyPicker.test.jsx`

- [ ] **Step 1: Write failing tests** — renders only fetched values; keyboard add/remove; max enforced; loading/error state announces; empty vocabulary still renders help text.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(ui): shared field/skill vocabulary pickers`.

### Task 7: Employer posting form

**Files:**
- Modify: `src/features/employer/JobPostFormDialog.jsx`, tests in `src/features/employer/__tests__/` (`JobPostFormDialog` suite)

**Interfaces:**
- New "Field" single-select (from `job_field`); new "Skills required" multi-select (from `skill`, max 20); `JOB_TAGS` block re-labelled **"Highlights"** with helper copy ("Attributes shown on the card — not skills"); work arrangement control unchanged and visually separate.
- Edit mode pre-fills both; duplicate respects both.

- [ ] **Step 1: Write failing tests** — field+skills persist on save; Highlights selection does not appear in the skills field; edit pre-fill; validation error when skills exceed max.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(employer): field and skills pickers on job postings`.

### Task 8: Seeker profile + registration

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx` (replace the free-text skills `TagField` with the picker; add Field select), `src/features/auth/JobSeekerRegister.jsx` + `src/features/auth/JobSeekerBackgroundStep.jsx` (same controls), `src/shared/utils/resumeAutofill.js` output mapping (skills map into vocabulary where they match; unmatched stay out of the picker but are surfaced as "Unrecognized: …" — no silent loss)
- Test: `Profile.skills.test.jsx` (new), `ProfileResumeAutofill.test.jsx`, registration suites

- [ ] **Step 1: Write failing tests** — picker shows vocabulary; saved skills render canonical case; autofill maps a known skill and lists an unknown one; Field is optional on the seeker profile (server accepts null) and selects as "Not set" until chosen.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(job-seeker): controlled field and skills`.

### Task 9: Terminology unification (finding 2)

**Files:**
- Create: `src/shared/content/matching.js` — the canonical strings (single source): `MATCHING_NAME`, `MODE_AI`, `MODE_STANDARD`, `MATCH_UNAVAILABLE`, `MATCHING_NOTICE`, `DIALOG_AI_NOTICE`
- Modify: `src/shared/components/JobsBrowser.jsx` (`MATCH_UNAVAILABLE`, `matchModeLabel`, Notice), `src/shared/components/PreferenceMatching.jsx`, `src/features/job-seeker/PreferenceMatching.jsx` (delete duplicate; point `PreferenceMatching.ai.test.jsx` at the shared component), `src/features/job-seeker/Dashboard.jsx` (badge copy if it says "AI")
- Test: `OpportunityList.matching.test.jsx`, `PreferenceMatching.ai.test.jsx`, `Jobs.loading.test.jsx`, new `matching.copy.test.js` asserting no user-facing string contains both "AI" and "not AI"

**Canonical copy (Decision 1; confirm wording before editing):**
- Name: `Skills-based matching`
- Mode: `AI-assisted ranking active` / `Skills-based ranking`
- Unavailable: `AI assistance is unavailable — showing skills-based ranking.`
- Notice: `Ranked by exact skill matches, barangay, preferred position, and recency. When available, AI re-ranks the top results and writes the reasons. It is not a hiring score or a guarantee.`
- Dialog: `Your request may be processed by an AI provider to re-rank vacancies. Never include personal details; your name and resume are never sent.`

- [ ] **Step 1:** Inventory every string with `grep -rn "AI" src/features src/shared | grep -v __tests__`; list the ones not covered by this task's file set in the commit message.
- [ ] **Step 2:** Rewrite tests to the canonical strings → FAIL. **Step 3:** Implement + delete the duplicate component. **Step 4:** PASS + `npm test`. **Step 5:** Commit `copy: unify skills-based matching terminology`.

### Task 10: Display separation (finding 4)

**Files:**
- Modify: `src/shared/components/JobCard.jsx` (Field badge; Skills chips group; Highlights chips group only when present; work arrangement as a meta item, not a tag; conditional "Verified employer" on `employers.accreditation_status === 'approved'`), `src/features/job-seeker/JobDetail.jsx`, `src/features/public-site/PublicJobDetail.jsx` (grouped sections: Field / Skills / Highlights / Work arrangement), `src/shared/components/JobsBrowser.jsx` (Field filter replaces category)
- Test: `JobCard.test.jsx` (new), detail suites, `OpportunityList.matching.test.jsx`

- [ ] **Step 1: Write failing tests** — card renders Field, skills, highlights as separate groups with accessible names; arrangement never appears in the tag groups; legacy job (nulls) renders no empty groups; unaccredited employer shows no Verified badge.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + `npm run build`. **Step 5:** Commit `feat(ui): separate field, skills, highlights, and work arrangement`.

### Task 11: Browse Jobs restructure (finding 5)

**Files:**
- Modify: `src/shared/components/JobsBrowser.jsx`
- Test: `OpportunityList.matching.test.jsx`, `Jobs.loading.test.jsx`, new `JobsBrowser.layout.test.jsx`

**Layout:** matching panel (non-compact `PreferenceMatching`) first, directly under the heading; then results; filters move into a `Filter results` disclosure (native `<details>` or button + region) collapsed by default at `<lg`, open at `≥lg` but visually secondary; Field filter replaces category; empty state keeps the matching CTA. Keep the 200-job fetch and client-side filtering (no server work).

- [ ] **Step 1: Write failing tests** — matching panel precedes results in DOM; filters collapsed by default at mobile width; every filter control reachable and labelled when open; Field filter narrows by `job.field`; no "Narrow your search" sidebar prominence assertion.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + axe check on the suite. **Step 5:** Commit `feat(ui): center skills-based matching on Browse Jobs`.

### Task 12: Homepage restructure (finding 5)

**Files:**
- Modify: `src/features/public-site/HomeHero.jsx` (primary CTA `Find jobs matched to my skills` → `/jobs`; keyword/barangay form relabelled `Search all jobs` secondary), `src/features/public-site/CommunitySections.jsx` (replace the generic `STEPS` block with three pillars: Skills-based matching → what it uses and does not claim; PESO-accredited employers → accreditation flow; Application & employment tracking → applicant timeline/employment tracking), tests `HomeHero`/`Landing` suites
- Test: new `Homepage.pillars.test.jsx`

- [ ] **Step 1: Write failing tests** — hero primary link text; three pillar headings and destinations; matching pillar copy matches Task 9's constants.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + `npm run build`. **Step 5:** Commit `feat(public): matching, accreditation, tracking pillars on home`.

### Task 13: Verification pass

- [ ] **Step 1:** `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build`.
- [ ] **Step 2:** `npm run preview` + `npm run syscheck` (public route sweep, zero console/CSP errors).
- [ ] **Step 3:** Manual checklist against the report: employer posts with a Field + Skills → seeker with the same skill sees the vacancy ranked and the overlap badge; a legacy job still renders; Browse Jobs matching panel first; homepage pillars link correctly.
- [ ] **Step 4:** Update `docs/plan/2026-11-20-peso-revision-verification.md` statuses (2 → resolved by Decision 1 + Task 9; 3, 4 → resolved by Tasks 1–8, 10; 5 → Tasks 11–12) and move this plan to `docs/plan/done/` once verified.

## Appendix — external actions (findings 2 and 6)

- **Paper/defense (finding 2):** use exactly: “JobLinked uses skills-based matching: vacancies are ranked by exact skill overlap, barangay, preferred position, and recency. When an AI provider is configured, it re-ranks the top results and writes short reasons; AI is an optional assist, not the matching method, and the score is not a hiring score or a guarantee.” Also state that in the evaluated configuration the deterministic path always applies and the AI path is evaluated separately.
- **PESO needs analysis (finding 6):** cite the office's needs-analysis document as the source of the revision requirements, in the paper's methodology/requirements section and on the defense deck (one slide, matching the paper's section number). Not verifiable from this repo — owner action.

## Explicitly NOT in scope

- Finding 1 (employer dashboard) — PASS; no work.
- Changing match weights, adding embeddings/semantic matching, or server-side filtering.
- Migrating existing `tags` values or renaming the column.
- Renumbering or rewriting the Better Auth plan (separate track).
