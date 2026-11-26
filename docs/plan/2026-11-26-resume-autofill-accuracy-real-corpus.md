# Resume Auto-fill Accuracy — Real-Corpus Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift resume auto-fill to ≥90% correct/filled per long-string field measured over a real-resume golden corpus, fixing regex-mapper misses only; re-open the ADR-045 LLM endpoint only if a field still misses the bar.

**Architecture:** Client pipeline unchanged (pdfjs/mammoth → `mapResumeText`). Grow `sample_pdf/golden/` with real anonymized Filipino resumes, measure with the existing `eval:autofill` harness, classify every miss (mapper / extraction / annotation), fix in ≤3 TDD clusters inside `src/shared/utils/resumeAutofill.js`, then hold an explicit decision gate.

**Tech Stack:** Existing dependencies only — Vitest, pdfjs-dist/legacy + mammoth (eval harness), Node script. No new packages, no server, no DB, no UI changes.

**Spec:** `docs/arch/adr-045-resume-autofill-accuracy.md` (amended 2026-11-26 — phase order).

## Confirmed brief (2026-11-26)

Measure-first, regex-only. Owner drops 10–20 real anonymized Filipino resumes into the golden corpus; misses get classified and fixed in ≤3 clusters; the ADR-045 LLM path stays deferred behind the ≥90% gate. Out of scope: LLM endpoint implementation, extraction-layer rewrite, per-field confidence scores, new form fields, resume storage changes.

## Global Constraints

- JavaScript/JSX only (no TypeScript)
- No new npm dependencies; no server, DB, schema, or UI changes — `useResumeAutofill.js`, `JobSeekerPersonalStep.jsx`, `ResumeAutofill.jsx` are untouched
- Never commit real PII — fixtures are anonymized by the owner before drop-in
- `mapResumeText` contract unchanged: same signature, same 13 scalar fields + `skills[]` + `education{level, school, field, year}`; education level values stay within the existing `EDU_ORDER`; skills ≤ 20 items, each ≤ 40 chars, ≤ 5 words
- Scrambled/garbled extracted text leaves fields **blank**, never garbled values (existing blank contract)
- `scripts/eval-autofill.mjs` stays advisory: exit 0 always
- Tests colocate (`*.test.js(x)`); `npm test` + `npm run lint` green before any commit step
- Commit style: short imperative (`test:`, `fix(resume):`, `eval:`, `docs:`)

## Review Focus

- **Unanonymized PII in committed fixtures** — a real name/phone/email slipping into `sample_pdf/golden/`. Expected: only clearly fictional contact data committed. *Pinned: Task 1 Step 3 regex sweep.*
- **Annotation drift** — `.expected.json` disagrees with the resume's visible content; a mapper "miss" that isn't one. Expected: every `pass:false` cell traceable to actual resume text, or the annotation corrected. *Pinned: Task 2 Step 4 `annotation` bucket + rerun.*
- **Extraction garble misread as mapper miss** — two-column or scanned PDFs where pdfjs text is scrambled; no regex fix can help. Expected: classified `extraction`, recorded as a finding, not chased into mapper contortions. *Pinned: Task 2 Step 4 `extraction` bucket.*
- **Blank-on-garbled regression** — a fix that makes the mapper emit garbled values on unreadable text. Expected: blank contract still holds on scrambled fixtures. *Pinned: Task 3/4/5 Step 5 eval comparison.*
- **Synthetic-fixture regression** — a real-resume fix that breaks the original 7 fixtures. Expected: no previously-passing field regresses. *Pinned: Task 3/4/5 Step 5 eval comparison (the original fixtures run in the same eval).*

## Measurement definitions

- Per-field accuracy = `correct / filled` from the harness table; `filled` = fixtures whose resume genuinely carries that value; `filled = 0` renders "—" and that field is **exempt** from the gate this round (recorded with its row).
- **Long-string gate set (12):** `firstName`, `middleName`, `lastName`, `houseNumberUnit`, `streetAddress`, `subdivisionBuilding`, `barangayDistrict`, `cityMunicipality`, `provinceState`, `postalCode`, `education.school`, `skills`. The remaining fields (`email`, `mobileNumber`, `birthdate`, `education.level`, `education.field`, `education.year`) are deterministic or short-coded; they are still fixed when they miss, but do not gate.
- Gate: **every** gate-set field ≥ 90% correct/filled over the real corpus.

---

### Task 1: Real corpus intake + annotation

**Files:**
- Create: `sample_pdf/golden/real01.{pdf|docx}` … `realNN.{pdf|docx}` (owner-supplied, anonymized)
- Create: `sample_pdf/golden/real01.expected.json` … (one per fixture)

**Interfaces:**
- Consumes: owner-provided anonymized resumes (10–20 target; if fewer than 10 arrive, proceed and record the smaller n in the baseline).
- Produces: fixture + `expected.json` pairs the harness scores. Naming convention: `realNN`. Files must land before anything else runs — **owner gate**.

- [ ] **Step 1: Owner gate — drop the anonymized resumes into `sample_pdf/golden/`** and confirm the drop in the task thread. Nothing else in this plan can run before this step.
- [ ] **Step 2: Annotate each fixture** with a sibling `realNN.expected.json`, reading values off the resume's visible content (comparison is normalized — trim, case-fold, collapsed whitespace — so write them as they appear). Blank string = the resume genuinely lacks that value. Exact shape:

```json
{
  "fields": {
    "firstName": "", "middleName": "", "lastName": "", "email": "",
    "mobileNumber": "", "birthdate": "", "houseNumberUnit": "", "streetAddress": "",
    "subdivisionBuilding": "", "barangayDistrict": "", "cityMunicipality": "",
    "provinceState": "", "postalCode": ""
  },
  "skills": [],
  "education": { "level": "", "school": "", "field": "", "year": "" }
}
```

- [ ] **Step 3: PII sweep** — search the new fixtures for `09\d{2}[ -]?\d{3}[ -]?\d{4}` and `[\w.+-]+@[\w-]+\.\w+` (rg or a one-line node script). Every hit must be clearly fictional (`juan.delacruz@example.com` style); any real-looking contact data → owner re-anonymizes that fixture before commit.
- [ ] **Step 4: Run** `npm run eval:autofill` — `files: N scored, 0 failed` where N = total fixtures (original 7 + new). Unreadable file → logged `failed` by the harness; fix or exclude it with the owner before proceeding.
- [ ] **Step 5: Commit** `test(resume): add real-resume golden corpus fixtures`

### Task 2: Baseline run, miss classification, `--text` debug flag

**Files:**
- Modify: `scripts/eval-autofill.mjs`
- Modify: this plan file (baseline table + classification recorded below Task 2)

**Interfaces:**
- Consumes: Task 1 corpus.
- Produces: (a) baseline per-field table recorded in this plan; (b) a three-bucket classification for every `pass:false` cell; (c) `node scripts/eval-autofill.mjs --text=sample_pdf/golden/<file>` prints the extracted text for one fixture via the same `extractText` path — Tasks 3–5 depend on this flag.

- [ ] **Step 1: Add the `--text` flag** to `scripts/eval-autofill.mjs`: when `process.argv` contains `--text=<path>`, print `await extractText(path, ext)` and exit 0. All other behavior unchanged (no args → current report flow).
- [ ] **Step 2: Verify the flag** — run it on one known fixture (e.g. `resume_sample.pdf`); output reads as the same text whose mapping the eval report describes.
- [ ] **Step 3: Run** `npm run eval:autofill` and paste the full per-field table into this plan under **Baseline (real corpus)** below.
- [ ] **Step 4: Classify every `pass:false` cell** into exactly one bucket:
  - `mapper` — extracted text visibly contains the right value; the mapper missed it. (Tasks 3–5 fix these.)
  - `extraction` — pdfjs/mammoth produced garbled/scrambled text for that fixture. Record as an extraction-layer finding (fixture + field + one line). Do **not** write a mapper fix that chases garbled input.
  - `annotation` — `expected.json` disagrees with the resume's visible content. Correct the `expected.json` in this task, rerun the eval, re-classify.
- [ ] **Step 5: Commit** `eval: add fixture text flag` and `docs: record real-corpus autofill baseline`

> Baseline (real corpus) — paste the table here at Task 2 Step 3:

_(pending)_

> Miss classification — paste per-cell buckets here at Task 2 Step 4:

_(pending)_

---

### Task 3: Fix cluster — name (`firstName` / `middleName` / `lastName`)

**Files:**
- Modify: `src/shared/utils/resumeAutofill.js` (`splitName`, `mapName`, `despace` path)
- Test: `src/shared/utils/__tests__/resumeAutofill.test.js`

**Interfaces:**
- Consumes: Task 2 baseline + `--text` flag.
- Produces: unchanged `mapResumeText` contract with better name results.

- [ ] **Step 1: Check the table** — if Task 2 shows no name-field `mapper` misses, mark this task `skipped (no name misses)` with one line and move to Task 4.
- [ ] **Step 2: Write the failing tests** — for each name miss, get the fixture text via `node scripts/eval-autofill.mjs --text=<fixture>`, then add a unit test in `resumeAutofill.test.js` with that exact text as input and the annotated name parts as assertions (`out.firstName`, `out.middleName`, `out.lastName`).
- [ ] **Step 3: Run** `npx vitest run src/shared/utils/__tests__/resumeAutofill.test.js` — the new tests FAIL.
- [ ] **Step 4: Fix minimally in the name path** — predicate-level changes only (suffix stripping, particle/double-first lists, casing on despaced tokens, header/URL skip rules). No rewrite of `mapResumeText` or the field mapper.
- [ ] **Step 5: Verify** — unit tests PASS; run `npm run eval:autofill`: name fields improved, **no previously-passing field regressed** (compare against the baseline table), blank contract still holds on garbled fixtures.
- [ ] **Step 6: Commit** `fix(resume): name splitting from real corpus`

### Task 4: Fix cluster — address (7 address fields)

**Files:**
- Modify: `src/shared/utils/resumeAutofill.js` (`mapAddress`, `parseAddressBlock`, `startsAddress`, `continuesAddress`, segment classification)
- Test: `src/shared/utils/__tests__/resumeAutofill.test.js`

**Interfaces:**
- Consumes: Task 2 baseline + `--text` flag.
- Produces: unchanged `mapResumeText` contract with better address results.

- [ ] **Step 1: Check the table** — no address-field `mapper` misses → mark `skipped (no address misses)` and move to Task 5.
- [ ] **Step 2: Write the failing tests** — same procedure as Task 3 Step 2, asserting the annotated address fields (`houseNumberUnit` … `postalCode`) from the fixture text.
- [ ] **Step 3: Run** `npx vitest run src/shared/utils/__tests__/resumeAutofill.test.js` — the new tests FAIL.
- [ ] **Step 4: Fix minimally in the address path** — narrow predicate fixes (block start/continue rules, segment classification, label peeling). `parseAddressBlock` is the most entangled code here: prefer one-condition adjustments over restructuring.
- [ ] **Step 5: Verify** — unit tests PASS; `npm run eval:autofill`: address fields improved, no regression elsewhere, blank contract holds on garbled fixtures.
- [ ] **Step 6: Commit** `fix(resume): address parsing from real corpus`

### Task 5: Fix cluster — education + skills

**Files:**
- Modify: `src/shared/utils/resumeAutofill.js` (`mapEducation`, `mapSkills`, `SKILL_TERMS`, `splitSection`)
- Test: `src/shared/utils/__tests__/resumeAutofill.test.js`

**Interfaces:**
- Consumes: Task 2 baseline + `--text` flag.
- Produces: unchanged `mapResumeText` contract with better education/skills results.

- [ ] **Step 1: Check the table** — no `education.school`/`skills` `mapper` misses → mark `skipped (no education/skills misses)`.
- [ ] **Step 2: Write the failing tests** — same procedure as Task 3 Step 2, asserting `out.education` and `out.skills` from the fixture text.
- [ ] **Step 3: Run** `npx vitest run src/shared/utils/__tests__/resumeAutofill.test.js` — the new tests FAIL.
- [ ] **Step 4: Fix minimally** — likely paths: school-boundary cleanup in `mapEducation` (what remains after level/year stripping), `SKILL_TERMS` gazetteer extension, `splitSection` separators. Skills still respect the ≤20 / ≤40 chars / ≤5 words contract.
- [ ] **Step 5: Verify** — unit tests PASS; `npm run eval:autofill`: education/skills fields improved, no regression elsewhere, blank contract holds.
- [ ] **Step 6: Commit** `fix(resume): education and skills extraction from real corpus`

### Task 6: Decision gate

**Files:**
- Modify: this plan file (gate outcome recorded below)

**Interfaces:**
- Consumes: final eval table (after Tasks 3–5).
- Produces: the recorded gate verdict that either closes the round or re-opens ADR-045's LLM path as a separate follow-up plan.

- [ ] **Step 1: Compute the gate** — from the final table, list every gate-set field (see Measurement definitions) below 90% correct/filled; list any exempt (`filled = 0`) rows with their counts.
- [ ] **Step 2a: If no gate field is below 90%** — record: `Gate PASS (<date>): all gate fields ≥90% over N real fixtures.` Round complete.
- [ ] **Step 2b: If any gate field is below 90%** — record: `Gate FAIL (<date>): <field list>.` plus one finding line per field (what the mapper does today, what the fixture shows), and: `Recommendation: re-open ADR-045 LLM path (docs/arch/adr-045-resume-autofill-accuracy.md) as a follow-up plan.` **STOP — do not build the endpoint in this plan.**
- [ ] **Step 3: Commit** `docs: record autofill accuracy gate outcome`

> Gate outcome — recorded at Task 6:

_(pending)_

### Task 7: Verification sweep + close

- [ ] **Step 1: Run** `npm test` — green.
- [ ] **Step 2: Run** `npm run lint` — green.
- [ ] **Step 3: Run** `npm run eval:autofill` and paste the table under **Final (real corpus)** below.
- [ ] **Step 4: Commit** `docs: close real-corpus autofill accuracy round`, then move this plan to `docs/plan/done/`.

> Final (real corpus) — paste at Task 7 Step 3:

_(pending)_
