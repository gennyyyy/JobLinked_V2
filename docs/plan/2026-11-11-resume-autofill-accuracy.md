# Resume Auto-fill Accuracy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

- [ ] **Step 1: Create `sample_pdf/golden/resume_sample.expected.json`** with the already-committed `resume_sample.pdf` annotated (fields object + `skills` array)
- [ ] **Step 2: Write the harness** — scans `sample_pdf/golden/**`, extracts text (legacy pdfjs in Node), maps via heuristic mode, prints the report above; exit code 0 always (advisory tool)
- [ ] **Step 3: Run** `npm run eval:autofill` — report renders, per-field accuracy table prints, no throw on unreadable files (logged as `failed` and excluded)
- [ ] **Step 4: Delete `test_samples.mjs`** (its logic moved here), commit

### Task 2: Golden corpus (Filipino resumes)

**Files:**
- Create: `sample_pdf/golden/` — 6 synthetic Filipino resumes (`.pdf` × 3, `.docx` × 3) with layout variety (labeled fields, wrapped 3-line address, letter-spaced headers, signature-block name trap, two-column skills block, plain text) + a matching `*.expected.json` each

**Interfaces:**
- Consumes: Task 1 harness. Produces: the baseline the rest of the plan measures against.

- [ ] **Step 1: Generate the 6 fixtures** (realistic Filipino data — "Juan Dela Cruz", "Barangay Poblacion, Davao City" style, no real PII)
- [ ] **Step 2: Write the 6 `.expected.json`** by hand from the fixture content
- [ ] **Step 3: Run** `npm run eval:autofill` and record the baseline numbers in the plan file below (paste the table)
- [ ] **Step 4: Request 10–20 real (anonymized) Filipino resumes from the owner** and add them the same way — the owner said real resumes misfire, so the corpus needs real layouts; note in PR that corpus grows without code changes

> Baseline table (heuristic mode) — fill at Step 3: _[per-field accuracy]_

### Task 3: Review-first UX (make auto-filled values visible)

**Files:**
- Modify: `src/features/auth/useResumeAutofill.js` (return `touched` — array of FIELDS labels actually changed)
- Modify: `src/features/auth/JobSeekerPersonalStep.jsx` (status line lists touched field labels; `aria-live` already present)
- Test: `src/features/auth/__tests__/JobSeekerRegister.test.jsx`

**Interfaces:**
- Consumes: existing `mapResumeText` output
- Produces: `useResumeAutofill(...) => { autofillStatus, touched, handleResumeChange }` where `touched = ["firstName","streetAddress",…]`

- [ ] **Step 1: Write the failing test** — after a mocked successful extraction, the status node lists field labels (`"Autofill done — please check: First name, Street address"`) and non-touched fields unchanged
- [ ] **Step 2: Run** `npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx` — expect FAIL (nothing lists touched fields yet)
- [ ] **Step 3: Implement** the touched-fields return + status line compose
- [ ] **Step 4: Run** test — PASS; then `npm test` full suite green
- [ ] **Step 5: Commit** `feat(register): show which fields autofill touched`

### Task 4: Server endpoint `POST /api/ai/resume-extract`

**Files:**
- Create: `server/src/ai/resumeExtract.js` + `server/src/ai/resumeExtract.test.js`
- Modify: `server/src/routes/ai.js` (route + `resumeExtractLimiter`)
- Test: colocated

**Interfaces:**
- Consumes: `aiProvider.js` (`cfg()` pattern, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`), `err()` helper, existing rate-limit middleware pattern (per-IP limit 10/hour), `helmet`/`cors` middleware chain of `app.js`
- Produces: the API contract above; `validateExtract(rawJson)` → normalized fields or throws `INVALID_INPUT`; `buildPrompt(text)` → `{system, user}` used by one OpenRouter chat completion with `response_format: json_object`

- [ ] **Step 1: Write failing tests** — (a) validation drops unknown keys and clamps lengths; (b) education level must be one of `EDU_ORDER` else empty; (c) `<120` chars → 400 `INVALID_INPUT`; (d) `>20000` chars → 400; (e) unset key/model → 503 `AI_NOT_CONFIGURED`; (f) upstream non-JSON → 502 `AI_UPSTREAM`; (g) prompt-injection payload yields schema-valid output only
- [ ] **Step 2: Run** `npm --prefix server test -- run src/ai/resumeExtract.test.js` → FAIL
- [ ] **Step 3: Implement** module + route; prompt pins: Filipino address conventions, JSON-only output, fields list verbatim, "leave empty when unsure" (empty string is the right answer)
- [ ] **Step 4: Run** module tests → PASS; `npm --prefix server test` → green
- [ ] **Step 5: Commit** `feat(api): add resume-extract endpoint (gated, validated)`
- [ ] **Step 6: Manual smoke** — `curl` the endpoint with a 200-char string against the dev API (needs `OPENROUTER_API_KEY` in `server/.env`); paste response in PR notes

### Task 5: Client hybrid — consent gate + LLM path + fallback

**Files:**
- Modify: `src/features/auth/useResumeAutofill.js` (branch on consent; POST via `api.js`; 503/502/429 → heuristic fallback + status message)
- Modify: `src/shared/utils/resumeAutofill.js` (add `mergeResumeFields(formOut, llmFields)` — LLM answers override heuristic for its keys; regex keeps email/phone/birthdate)
- Modify: `src/features/auth/JobSeekerPersonalStep.jsx` (consent checkbox: "Use AI to read my resume — sends the file's text to an AI service"; default unchecked)
- Test: `src/features/auth/__tests__/JobSeekerRegister.test.jsx` (mock `fetch`)

**Interfaces:**
- Consumes: Task 4 contract; `apiUrl()`; Task 3 touched-fields
- Produces: same public hook shape (+ `consent`, `setConsent`); downstream (JobSeekerRegister) unchanged

- [ ] **Step 1: Write failing tests** — (a) consent OFF behavior identical to today; (b) consent ON → 200 response fields merged (LLM name wins over regex; email stays regex); (c) provider 503 → heuristic result + status "AI read unavailable — used built-in detection"; (d) 400 over-long text → same fallback message
- [ ] **Step 2: Run** target test file → FAIL
- [ ] **Step 3: Implement** hook branch + `mergeResumeFields` + checkbox JSX (theme tokens)
- [ ] **Step 4: Run** file → PASS; `npm test` green; `npm run lint` green
- [ ] **Step 5: Commit** `feat(register): consent-gated AI resume extraction with fallback`

### Task 6: LLM mode in eval + CI advisory

**Files:**
- Modify: `scripts/eval-autofill.mjs` (`--mode=llm --base=http://localhost:4000` — posts each file's text to Task 4 endpoint; skipped per-file with a `needs-server` note when base is unreachable or endpoint 503s)
- Modify: `.github/workflows/ci.yml` — advisory step: `npm run eval:autofill` (heuristic mode only, `continue-on-error: true`) with the summary table as the job output

**Interfaces:**
- Consumes: Tasks 1, 4. Produces: LLM-mode accuracy numbers against the same corpus (the ≥90% measurement).

- [ ] **Step 1: Implement `--mode=llm`**
- [ ] **Step 2: Run locally** (API + `OPENROUTER_API_KEY` up): record the LLM-mode table below; target ≥90% on `firstName/lastName`, address fields, `education.school`
- [ ] **Step 3: Add CI advisory step**
- [ ] **Step 4: Commit** `eval: add llm mode + ci advisory`

> LLM-mode table — fill at Step 2: _[per-field accuracy]_

### Task 7: Fix what the corpus reveals (heuristic mode)

**Files:**
- Modify: `src/shared/utils/resumeAutofill.js` (name splitting, school boundaries, address peeling — only what Task 2/6 numbers justify)
- Test: `src/shared/utils/__tests__/resumeAutofill.test.js`

**Interfaces:**
- Consumes: baseline + LLM tables from Tasks 2/6. Produces: same `mapResumeText` contract.

- [ ] **Step 1: For each per-field miss in the baseline table**, add the fixture text as a unit test with the expected value → cluster into at most 3 fixes (name / school / address)
- [ ] **Step 2: Red→green each cluster**, rerun `npm run eval:autofill`, confirm no other field regressed
- [ ] **Step 3: Commit** `fix(resume): split-name and address peeling regressions from corpus`
- [ ] **Step 4: Gate rule** — if LLM-mode table ≥90% on long-string fields: mark ADR-045 accepted with the numbers; else loop back to prompt/fixture work before signing off

### Task 8: Verification sweep (sign-off gate)

- [ ] `npm test`, `npm run lint`, `npm --prefix server test` green
- [ ] Manual: consent OFF → identical to today; consent ON → correct fields on a real resume; provider down → clean fallback; registration completes on all paths
- [ ] `grep -r "SELECT\|INSERT\|console.log" server/src/ai` — no resume text in logs
- [ ] Move this plan to `docs/plan/done/` when all above pass

## State Strategy

`useResumeAutofill` stays the single owner of auto-fill state, extended in place: `idle → reading → extracting → done|fallback`, exposed via the existing `autofillStatus` string plus `touched` and `consent`/`setConsent`. No new context/store — the hook already lives only in `JobSeekerRegister`.

## Open inputs for the owner

1. **Corpus:** drop 10–20 real (anonymized) Filipino resumes into `sample_pdf/golden/` — this is what makes the ≥90% claim real rather than synthetic.
2. **Consent copy sign-off:** the checkbox text doubles as the privacy notice (OpenRouter = third-party). Legal wording can be tightened later in the privacy page, but the checkbox line needs owner approval.
