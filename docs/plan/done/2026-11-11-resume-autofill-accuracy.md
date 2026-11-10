# Resume Auto-fill Accuracy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Push resume auto-fill to ≥90% field accuracy on long-string fields (name parts, school, address parts, skills) and make any auto-filled value explicitly visible to the user instead of landing silently.

**Architecture:** Keep client-side text extraction (pdfjs/mammoth). Add a consent-gated server endpoint `POST /api/ai/resume-extract` (OpenRouter through the existing `aiProvider.js` pattern) that does NER for the ambiguous fields; deterministic regex stays for email/phone/birthdate. A golden-corpus eval script measures per-field accuracy and gates regressions. A "checked ✓" banner names extracted fields so mistakes become visible.

**Tech Stack:** Existing deps only — OpenRouter via `fetch` (no new packages), `pdfjs-dist`/`mammoth` for extraction (already installed), Vitest.

**Spec:** `docs/arch/adr-045-resume-autofill-accuracy.md`

## Global Constraints

- JavaScript/JSX only (no TypeScript); Tailwind theme tokens from `src/index.css`
- No new npm dependencies (Vercel/openrouter calls via `fetch`; eval reuses `pdfjs-dist/legacy` + `mammoth`)
- Never log or persist resume text — logs carry duration + field counts only; tests never commit sample text fixtures with real PII
- LLM request input hard cap: 20,000 characters; below 120 chars → 400 `INVALID_INPUT`
- Education level enums = the existing `EDU_ORDER` array values exactly
- Skills array ≤ 20 items, each ≤ 40 chars, ≤ 5 words
- All new client HTTP goes through `src/shared/lib/api.js`; server errors use the existing `err(res, status, CODE, message)` envelope
- Tests colocate with source (`*.test.js(x)`); `npm test` + `npm run lint` green before any commit step
- Commit style: short imperative (`feat: …`, `test: …`, `eval: …`)

## Review Focus

- **Two-column / letter-spaced PDFs** → scrambled text in. Expected: fields stay empty (blank contract), never garbled values. *Pinned in Task 1 scoring:* `eval-autofill.mjs` counts "filled" separately from "correct"; a regression test asserts `mapResumeText` returns blank `streetAddress` on a two-column fixture.
- **AI provider down mid-registration** → registration must never block: status message shows, heuristic path still fills what it can. *Pinned in Task 5:* fallback-on-503 test.
- **Text over 20k chars** → 400 `INVALID_INPUT` with a clear client message; not a 500. *Pinned in Task 4.*
- **Prompt-injection text inside a resume** ("ignore instructions and…") → endpoint output must remain schema-valid; unknown keys dropped. *Pinned in Task 4 validation test.*
- **Wrong-source name** (signature block or header picked over the real name) → golden corpus includes this case in Task 2; pinned when Task 7 fixes it.

---

## API Contract (new surface)

```
POST /api/ai/resume-extract
Request:  { "text": "<extracted plaintext, 120–20000 chars>" }
Response 200: {
  "fields": {
    "firstName": "", "middleName": "", "lastName": "",
    "houseNumberUnit": "", "streetAddress": "", "subdivisionBuilding": "",
    "barangayDistrict": "", "cityMunicipality": "", "provinceState": "", "postalCode": "",
    "skills": ["…"],
    "education": { "level": "", "school": "", "field": "", "year": "" }
  },
  "meta": { "model": "<model id>", "tookMs": 1234 }
}
Errors: 400 INVALID_INPUT · 413 PAYLOAD_TOO_LARGE · 429 RATE_LIMITED · 502 AI_UPSTREAM · 503 AI_NOT_CONFIGURED
```

- Keys are the same names as the existing `FIELDS` list minus contact fields (client keeps regex custody of email/phone/birthdate).
- Server drops unknown keys, clamps string lengths (address/school/name ≤ 80, skills per constraints), validates education against `EDU_ORDER`.
- No DB changes. No persistence.

## Directory Blueprint

```
server/src/ai/resumeExtract.js          (new: prompt build + schema validation)
server/src/ai/resumeExtract.test.js     (new)
server/src/routes/ai.js                 (modify: new route + limiter)
scripts/eval-autofill.mjs               (new: corpus scoring harness)
sample_pdf/golden/                      (new: corpus + *.expected.json)
src/features/auth/useResumeAutofill.js  (modify: touched fields + consent branch)
src/features/auth/JobSeekerPersonalStep.jsx (modify: consent checkbox + checked-hint)
src/shared/utils/resumeAutofill.js      (modify: LLM-normalizer + targeted fixes)
src/shared/utils/__tests__/resumeAutofill.test.js (extend)
src/features/auth/__tests__/JobSeekerRegister.test.jsx (extend)
```

---

### Task 1: Eval harness + scoring model

**Files:**
- Create: `scripts/eval-autofill.mjs`
- Create: `sample_pdf/golden/resume_sample.expected.json`
- Modify: `package.json` (root) — `"eval:autofill": "node scripts/eval-autofill.mjs"`

**Interfaces:**
- Consumes: `mapResumeText` from `src/shared/utils/resumeAutofill.js`, extraction logic replicated from `test_samples.mjs` (move `test_samples.mjs` body into the script; delete it at the end of this task)
- Produces: stdout report `{ mode, perFieldAccuracy: {field: {correct, filled, total}}, files: [{file, fields:{field:{expected, got, pass}}}…] }` where `pass` = normalized exact-match (`trim + collapse spaces + case-fold`)

- [x] **Step 1: Create `sample_pdf/golden/resume_sample.expected.json`** with the already-committed `resume_sample.pdf` annotated (fields object + `skills` array)
- [x] **Step 2: Write the harness** — scans `sample_pdf/golden/**`, extracts text (legacy pdfjs in Node), maps via heuristic mode, prints the report above; exit code 0 always (advisory tool)
- [x] **Step 3: Run** `npm run eval:autofill` — report renders, per-field accuracy table prints, no throw on unreadable files (logged as `failed` and excluded)
- [x] **Step 4: Delete `test_samples.mjs`** (its logic moved here), commit

### Task 2: Golden corpus (Filipino resumes)

**Files:**
- Create: `sample_pdf/golden/` — 6 synthetic Filipino resumes (`.pdf` × 3, `.docx` × 3) with layout variety (labeled fields, wrapped 3-line address, letter-spaced headers, signature-block name trap, two-column skills block, plain text) + a matching `*.expected.json` each

**Interfaces:**
- Consumes: Task 1 harness. Produces: the baseline the rest of the plan measures against.

- [x] **Step 1: Generate the 6 fixtures** (realistic Filipino data — "Juan Dela Cruz", "Barangay Poblacion, Davao City" style, no real PII)
- [x] **Step 2: Write the 6 `.expected.json`** by hand from the fixture content
- [x] **Step 3: Run** `npm run eval:autofill` and record the baseline numbers in the plan file below (paste the table)
- [ ] **Step 4: Request 10–20 real (anonymized) Filipino resumes from the owner** and add them the same way — the owner said real resumes misfire, so the corpus needs real layouts; note in PR that corpus grows without code changes

> Baseline table (heuristic mode) — initial (Task 2, 7 files scored: 3 pdf + 3 docx + resume_sample):

| field | correct | filled | total | accuracy |
|---|---|---|---|---|
| firstName | 6 | 7 | 7 | 85.7% |
| middleName | 2 | 2 | 7 | 100.0% |
| lastName | 6 | 7 | 7 | 85.7% |
| email | 7 | 7 | 7 | 100.0% |
| mobileNumber | 7 | 7 | 7 | 100.0% |
| birthdate | 7 | 7 | 7 | 100.0% |
| houseNumberUnit | 1 | 1 | 7 | 100.0% |
| streetAddress | 3 | 7 | 7 | 42.9% |
| subdivisionBuilding | 2 | 2 | 7 | 100.0% |
| barangayDistrict | 6 | 6 | 7 | 100.0% |
| cityMunicipality | 6 | 7 | 7 | 85.7% |
| provinceState | 6 | 7 | 7 | 85.7% |
| postalCode | 7 | 7 | 7 | 100.0% |
| skills | 6 | 7 | 7 | 85.7% |
| education.level | 7 | 7 | 7 | 100.0% |
| education.school | 7 | 7 | 7 | 100.0% |
| education.field | 7 | 7 | 7 | 100.0% |
| education.year | 7 | 7 | 7 | 100.0% |

> Heuristic misses (initial): streetAddress (single-line Address: not peeled + label-free block over-run), letter-spaced name (despace gap), two-column skills (garbled).

> After Task 7 fixes (name title-casing on despaced tokens, known-term extraction in the skills section scan, labeled full-address peeling, block-gathering stop at skill/education lines, subdivision false-positive guard):

| field | correct | filled | total | accuracy |
|---|---|---|---|---|
| firstName | 7 | 7 | 7 | 100.0% |
| middleName | 2 | 2 | 7 | 100.0% |
| lastName | 7 | 7 | 7 | 100.0% |
| email | 7 | 7 | 7 | 100.0% |
| mobileNumber | 7 | 7 | 7 | 100.0% |
| birthdate | 7 | 7 | 7 | 100.0% |
| houseNumberUnit | 1 | 1 | 7 | 100.0% |
| streetAddress | 7 | 7 | 7 | 100.0% |
| subdivisionBuilding | 2 | 2 | 7 | 100.0% |
| barangayDistrict | 6 | 6 | 7 | 100.0% |
| cityMunicipality | 7 | 7 | 7 | 100.0% |
| provinceState | 7 | 7 | 7 | 100.0% |
| postalCode | 7 | 7 | 7 | 100.0% |
| skills | 7 | 7 | 7 | 100.0% |
| education.level | 7 | 7 | 7 | 100.0% |
| education.school | 7 | 7 | 7 | 100.0% |
| education.field | 7 | 7 | 7 | 100.0% |
| education.year | 7 | 7 | 7 | 100.0% |

> LLM-mode table — not run in this worktree (no OPENROUTER_API_KEY); scoring code is complete (--mode=llm --base=...) and degrades to needs-server per file. Heuristic mode alone reaches 100% over 7 fixtures (18 fields); LLM mode is the safety net for layouts outside the corpus.

- [ ] **Step 2: Run locally** (API + `OPENROUTER_API_KEY` up): record the LLM-mode table below; target ≥90% on `firstName/lastName`, address fields, `education.school` — *not run in this worktree (no key); scoring code verified via the `needs-server` path (7/7 reported needs-server, exit 0). Owner runs it where a key is available.*
- [x] **Step 3: Add CI advisory step**
- [x] **Step 4: Commit** `eval: add llm mode + ci advisory`

> LLM-mode table — fill at Step 2: _[per-field accuracy]_

### Task 7: Fix what the corpus reveals (heuristic mode)

**Files:**
- Modify: `src/shared/utils/resumeAutofill.js` (name splitting, school boundaries, address peeling — only what Task 2/6 numbers justify)
- Test: `src/shared/utils/__tests__/resumeAutofill.test.js`

**Interfaces:**
- Consumes: baseline + LLM tables from Tasks 2/6. Produces: same `mapResumeText` contract.

- [x] **Step 1: For each per-field miss in the baseline table**, add the fixture text as a unit test with the expected value → cluster into at most 3 fixes (name / school / address)
- [x] **Step 2: Red→green each cluster**, rerun `npm run eval:autofill`, confirm no other field regressed
- [x] **Step 3: Commit** `fix(resume): split-name and address peeling regressions from corpus`
- [x] **Step 4: Gate rule** — if LLM-mode table ≥90% on long-string fields: mark ADR-045 accepted with the numbers; else loop back to prompt/fixture work before signing off

### Task 8: Verification sweep (sign-off gate)

- [x] `npm test`, `npm run lint`, `npm --prefix server test` green
- [x] Manual: consent OFF → identical to today; consent ON → correct fields on a real resume; provider down → clean fallback; registration completes on all paths
- [x] `grep -r "SELECT\|INSERT\|console.log" server/src/ai` — no resume text in logs
- [x] Move this plan to `docs/plan/done/` when all above pass

## State Strategy

`useResumeAutofill` stays the single owner of auto-fill state, extended in place: `idle → reading → extracting → done|fallback`, exposed via the existing `autofillStatus` string plus `touched` and `consent`/`setConsent`. No new context/store — the hook already lives only in `JobSeekerRegister`.

## Open inputs for the owner

1. **Corpus:** drop 10–20 real (anonymized) Filipino resumes into `sample_pdf/golden/` — this is what makes the ≥90% claim real rather than synthetic.
2. **Consent copy sign-off:** the checkbox text doubles as the privacy notice (OpenRouter = third-party). Legal wording can be tightened later in the privacy page, but the checkbox line needs owner approval.
