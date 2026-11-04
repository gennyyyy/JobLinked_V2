# AI Job Matching Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real AI-ranking backend + client wiring for the job-seeker Browse Jobs "AI job matching" flow, replacing the honest placeholder, with deterministic fallback so the page can never break.

**Architecture:** A shared OpenAI-compatible provider module (`aiProvider.js`, provider chosen by env: NVIDIA NIM recipe documented) fronts one new route `POST /api/ai/job-match` that ranks the client's candidate ids: deterministic scorer always ranks the whole live pool; one cached LLM call re-ranks the top 30 with reasons; clients reorder their existing lists. Cache + per-user + global limits protect free-tier quotas.

**Tech stack:** Node 24 · Express · pg (existing) · Vitest · zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-05-ai-job-matching-and-help-design.md` (v1.1 — ranking-only contract §4; the plan argues from it).

**Executes together with:** Plan B (`docs/superpowers/plans/2026-11-05-role-aware-help-plan.md`) consumes Task 1's `resolveConfig/resolveModel/callChat`.

## Global Constraints

- JavaScript/JSX only; no TypeScript (repo rule).
- Zero new npm dependencies; no DB schema changes.
- Error bodies: `{ error: { code, message } }`; 429 body code `RATE_LIMITED`.
- Provider env (exact): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` default `https://openrouter.ai/api/v1`; NVIDIA recipe `OPENROUTER_BASE_URL=https://integrate.api.nvidia.com/v1` + an NVIDIA model id. Missing key never blocks boot (ADR-023 rule).
- Network payload contains ONLY: system instruction, the user's normalized prompt (≤500 chars), and public job fields (title, company, barangay, employment type, salary, tags, ≤300-char description excerpt). No profile identity, email, resume, or seeker name — assert in tests.
- Reasons: ≤200 chars normalized plain text (no newlines/control characters/markdown/URLs). Prompts: ≤500 chars normalized.
- Cache: in-memory, TTL 15 min, LRU 300, key includes candidate-id set hash. Global provider guard ≤20 calls/min per process.
- `jobMatchLimiter`: 30 miss-calls / 15 min per user (key `req.user?.id || ipKeyGenerator(req.ip)`), with library-native `skip` when the request is a cache hit.
- Response shape (exact): `{ mode: 'ai' | 'deterministic', ranking: string[], reasons: [{jobId, reason}], generatedAt: string }` — `ranking` covers every live candidate; provider failures ALWAYS produce a 200 deterministic response, never 503.

## Review Focus

1. **Provider misconfiguration with a prompt active** (expired key / unknown model → upstream 401/403/404): a reasonable person still gets a full ranked list, `mode: 'deterministic'`, HTTP 200. — Pinned by Task 4's `responds 200 deterministic on upstream 401/403/404`.
2. **Model output divergence** (markdown-fenced JSON, duplicate ids, unknown ids, >30 entries): output is sanitized — dupes/unknowns dropped, extras truncated, subset allowed, unranked pool appended. — Pinned by Task 4's `sanitizes model output…`.
3. **Empty seeker profile** (no skills/barangay/preferred position): ranking still covers every candidate via recency weight. — Pinned by Task 2's `handles an empty profile with recency-only ordering`.
4. **Unpublished/dead vacancy inside a candidate list** (employer closed a job while the list was open): server re-loads by id with `status='published'`, so dead ids get no ranking row. — Pinned by Task 4's `drops candidates that are no longer published`.
5. **User types personal/private details into the preference box**: dialog carries the exact privacy line before first send; nothing logs prompt text. — Pinned by Task 5's dialog copy test and Task 1's `never logs message content`.

---

### Task 1: Provider layer `server/src/aiProvider.js`

**Files:**
- Create: `server/src/aiProvider.js`
- Test: `server/src/aiProvider.test.js`
- Modify: `server/.env.example` (extend the existing OPENROUTER_ block comments with the NVIDIA recipe: base URL + "set OPENROUTER_MODEL to an NVIDIA model id; hosted NIM is prototype-grade, ~40 RPM, built for prototyping")

**Interfaces:**
- Produces (consumed by Task 4 and by Plan B):
  - `isConfigured() -> boolean` (non-empty `OPENROUTER_API_KEY`)
  - `resolveConfig() -> { key: string|null, base: string, model: string|null }` (base default `https://openrouter.ai/api/v1`; `model`: env value, else `openai/gpt-4o-mini` ONLY when base is that default, else `null`)
  - `normalize(text: unknown) -> string` (String-coerce, trim, collapse internal whitespace)
  - `callChat({ messages, maxTokens = 1200, timeoutMs = 10_000 }) -> Promise<{ kind: 'OK', reply: string } | { kind: 'UPSTREAM_FAILURE', status: number|null }>`
  - internal per-minute global guard: >20 `callChat` invocations in one rolling 60 s window return `{ kind: 'UPSTREAM_FAILURE', status: null }` without a network call; exported as `providerCallBudget` ONLY for tests (reset capability).
- Behavior: non-OK upstream (incl. 401/403/404/429/5xx), empty reply, timeout, or non-JSON body → `UPSTREAM_FAILURE` (kind covers all). Never throws for upstream states; network-stack exceptions also map to `UPSTREAM_FAILURE`. Log via existing `logger` (`server/src/logger.js`): status class + latency only.

- [ ] **Step 1: Write failing tests** in `server/src/aiProvider.test.js` (vitest; stub `fetch` with `vi.stubGlobal`):
  - `resolves openrouter defaults without env`
  - `picks the code default model only for the openrouter base` (env base = NVIDIA URL, model unset → `{ key, base: NVIDIA, model: null }`)
  - `returns OK for a valid completion` (fixture `{choices:[{message:{content:'hi'}}]}`)
  - `maps upstream 401/403/404/429/5xx to UPSTREAM_FAILURE, not errors` (loop the statuses)
  - `maps timeout and malformed bodies to UPSTREAM_FAILURE` (aborting signal + `"not json"`)
  - `stays under the global minute budget and reports exhaustion without calling fetch`
  - `normalize collapses whitespace`
  - `never logs message content` (spy logger calls, assert fixtures contain no fixture message text)
- [ ] **Step 2: Run** `npx vitest run --root server -- src/aiProvider.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** the module per Interfaces. Zero new dependencies (`fetch`, existing `logger`).
- [ ] **Step 4: Run** again → PASS.
- [ ] **Step 5: Commit** `feat(server): provider layer for OpenAI-compatible AI with fallback taxonomy`

### Task 2: Deterministic scorer `server/src/matching/score.js`

**Files:**
- Create: `server/src/matching/score.js`
- Test: `server/src/matching/score.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `rankPool(jobs, profile) -> { order: string[], reasons: [{ jobId, reason }] }`
  - `jobs`: rows with `{ id, title, description, tags?: string[], location?, created_at }`; `profile`: `{ skills: string[], barangay_district?: string, preferred_position?: string }`.
  - Weights (exact, from spec v1.1): skills/tags overlap 0.55 · barangay match (`profile.barangay_district === job.location`) 0.20 · preferred-position/title affinity 0.10 · recency 0.15. Missing profile signals drop + redistribute weights; ties → newest `created_at` first, then id.
  - `reasons` covers every input job, in ranked order, ≤200 chars each via `aiProvider.normalize`, e.g. `Skills match 3 of 5 · Same barangay`. Cap pool this module will score: first **30** jobs go into `reasons` (only the first 30 need reasons); `order` covers ALL jobs (top 30 first, remaining in deterministic order).
- Tests: named `score.test.js` cases: skills-overlap dominates; barangay tiebreak; `handles an empty profile with recency-only ordering`; `reasons are capped at 200 normalized chars` (feed a 400-char designed reason); stability with ties.

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run** `npx vitest run --root server -- src/matching/score.test.js` → FAIL
- [ ] **Step 3: Implement** (pure functions; use `aiProvider.normalize`)
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(server): deterministic job ranking scorer with explainable reasons`

### Task 3: Match cache + cache-miss-aware limiter

**Files:**
- Create: `server/src/matching/matchCache.js`
- Modify: `server/src/middleware/rateLimit.js` (append `jobMatchLimiter`)
- Test: `server/src/matching/matchCache.test.js`

**Interfaces:**
- Produces (consumed by Task 4):
  - `matchCache`: `{ keyFor(userId, prompt, candidateIds) -> string` (sha1-ish hash; candidateIds sorted-joined so order-independent `),`lookup(key) -> entry|null`, store(key, entry)`; entry `{ mode, ranking, reasons, generatedAt, expiresAt }`; TTL 15 min; LRU ≤300 (oldest evicted via Map insertion order).
  - `cacheHit(req) -> boolean`: true when `matchCache.lookup(matchCache.keyFor(req.body.candidateIds-free request))` is alive — implemented as `key = keyFor(req.body.prompt, req.body.candidateIds)` with `req.user.id`; safe on missing body (`false`).
- `jobMatchLimiter` (rateLimit.js): `rateLimit({ windowMs: 15*60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, handler: limited, keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip), skip: cacheHit })` — import cycle-free (matchCache imports nothing from rateLimit).
- Tests: `matchCache.test.js`: key is candidate-order-independent; TTL expiry (fake timers); LRU eviction; store/lookup round-trip. Limiter: direct middleware invocation test with fake `req/res/next` — bounded miss count returns 429 `{error:{code:'RATE_LIMITED'}}`; when `matchCache` holds an alive key, `skip` returns true (call passes, count unchanged).

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run** `npx vitest run --root server -- src/matching/matchCache.test.js` → FAIL
- [ ] **Step 3: Implement** cache + limiter
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(server): match result cache with miss-only rate limiting`

### Task 4: Route `POST /ai/job-match` (`server/src/routes/aiMatch.js`)

**Files:**
- Create: `server/src/routes/aiMatch.js`
- Modify: `server/src/app.js` (mount `aiMatchRoutes` next to `aiRoutes`, line ~98)
- Test: `server/src/routes/aiMatch.test.js` (same harness style as the existing `server/src/routes/ai.test.js`: supertest app + stubbed fetch + `vi.mock('./db.js')`)

**Interfaces:**
- Consumes: `auth, requireRole` (`../auth.js` — sets `req.user {id,email,role,app_metadata}`), `jobMatchLimiter` (`../middleware/rateLimit.js`), `rankPool` (Task 2), `matchCache` (Task 3), `aiProvider` (Task 1), `isUuid`, `err`, `ah` (`../util.js`), `pool` (`../db.js`).
- Produces: `POST /ai/job-match` per spec §4 response JSON above. Seeker signals query: `select skills, barangay_district, preferred_position from job_seekers where id = $1` (one query, pool from `../db.js`).
- Validation (400 `BAD_REQUEST`): prompt missing/not-string/normalized-empty/length >500; `candidateIds` not array, >200, or any non-uuid (via `isUuid`).
- Route order of operations: `matchCache.lookup(key)` FIRST (return cached entry sans `expiresAt`); else pipeline:
  1. `rankPool(liveJobs, profile)` where `liveJobs` = one `SELECT j.*, e.company_name, e.logo_path FROM job_vacancies j LEFT JOIN employers e ON e.id=j.company_id WHERE j.status='published' AND j.id = any($1::uuid[])` → determinstic base `{order, reasons}`.
  2. If `aiProvider.isConfigured()`: `callChat` with system prompt listing the top-30 candidates' public fields and demanding JSON array output; tolerant parse: JSON-fence strip, keep entries whose `jobId` ∈ live set, dedupe (first wins), truncate at 30, drop entries with missing/`>200`-char-after-normalize reasons? NO — truncate reason text to 200 chars; entries with empty reason strings are dropped entirely.
  3. `mode='ai'`: ranking = model ids + remaining in deterministic order, reasons = model reasons. Any provider failure (incl. `UPSTREAM_FAILURE` from Task 1, wrong JSON) → step 1's deterministic output.
  4. Store via `matchCache.store`; respond without `expiresAt`.
- Tests (exact case list):
  - `requires a provisioned job-seeker` (403 for employer via requireRole, anon 401)
  - `400 on ragged prompts/candidateIds` (missing, >500, >200 ids, non-uuid entry)
  - `deterministic path without an API key` (200, `mode:'deterministic'`, full `ranking`, reasons ≤200)
  - `responds 200 deterministic on upstream 401/403/404` (Review Focus 1)
  - `sanitizes model output`: fenced JSON ```` ```json ```` wrapper, duplicate + unknown ids + a 34th entry → dropped/ignored/truncated; `mode:'ai'`; unranked candidates appended
  - `drops candidates that are no longer published` (Review Focus 4)
  - `serves a cached pool without re-calling the provider and without counting the limiter` (second request after first: fetch spy + limiter counter unchanged)
  - `single-flights identical cache-miss requests` (two parallel requests → one fetch)
  - `upstream body carries only public job fields` (assert serialized fetch body: contains title/company/barangay; does NOT contain seeker email/name/profile text — Review Focus: PII lint)
  - `empty profile works` (no row or nulls → recency-based response, 200)

- [ ] **Step 1: Write failing tests** (cases above; stub fetch per case)
- [ ] **Step 2: Run** `npx vitest run --root server -- src/routes/aiMatch.test.js` → FAIL
- [ ] **Step 3: Implement** route + mount in `app.js` (`app.use('/api', …, aiRoutes, aiMatchRoutes)` — keep path string `/ai`)
- [ ] **Step 4: Run** route tests, then the whole server suite: `npx vitest run --root server` → PASS (existing suites untouched)
- [ ] **Step 5: Commit** `feat(server): AI job-match ranking endpoint with deterministic fallback`

### Task 5: Client wiring (services + dialog + list)

**Files:**
- Modify: `src/shared/services/ai.js` (add `matchJobs(prompt, candidateIds)` → `api.post('ai/job-match', { prompt, candidateIds })`)
- Modify: `src/features/job-seeker/PreferenceMatching.jsx` — copy changes: dialog description becomes "Send your preferences to start the matching experience. Your request is processed by an AI provider to rank vacancies. Never include personal details; your name and resume are never sent."; add props `mode: 'ai' | 'deterministic' | null` (header line: `AI ranking active` / `Standard matching · no AI`) and `busy: boolean` (Send button disabled); remove the assistant-fake paragraph (line ~25–32) and "No actual AI service is connected."
- Modify: `src/features/job-seeker/OpportunityList.jsx` — while `matchingPrompt` is set: fetch ranking with a local sequence guard (increment on prompt/page/filters change; ignore late resolutions); base pool ids = the jobs passing the saved/open+accredited pre-filter (reuse the existing `records` pre-filter chain, ids only, ≤200). On 200: order `records` by a rank map built from `ranking` and pass `match.reasons` reasons per card (new optional `matchReason` prop on the existing `JobCard`, rendered as a small muted line); on any non-200/catch: clear ranking state and set a one-line notice `AI matching is unavailable right now — showing standard results.` via the existing `Notice`-style banner; "Use standard matching" clears prompt + ranking instantly.
- Test: `src/features/job-seeker/__tests__/PreferenceMatching.ai.test.jsx` (copy assertions: privacy line present, placeholder line removed, busy state disables submit)
- Test: `src/features/job-seeker/__tests__/OpportunityList.matching.test.jsx` (mock `matchJobs`; asserts reordered result uses `ranking` order; `matchReason` passed to cards; reject → notice + standard order; late stale resolution ignored)

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run** `npx vitest run src/features/job-seeker` → new tests FAIL
- [ ] **Step 3: Implement** service, dialog, list wiring
- [ ] **Step 4: Run** `npx vitest run src/features/job-seeker src/shared/components` → PASS (JobCard additions don't break existing card tests)
- [ ] **Step 5: Commit** `feat(job-seeker): real AI preference matching with deterministic fallback`

### Task 6: Docs (contract + ADR) — small, final

**Files:**
- Modify: `docs/arch/rework/02-api-contract.md` (addendum: `POST /api/ai/job-match` request/response, error codes incl. "provider failures never 503", limiter numbers 30/15 min cache-miss-only, privacy statement)
- Create: `docs/arch/rework/08-ai-provider-and-matching.md` (NEXT sequential number — check `docs/arch/rework/` listing first; ADR: provider-agnostic OpenAI-compatible layer, deterministic-first hybrid, fallback taxonomy, in-process cache/limiter/guard single-instance caveat referencing ADR-037, free-tier data-policy notes, ADR-023 marked as still-valid for `/ai/help` with the model-default fix noted)

- [ ] **Step 1: Write both docs per content above**
- [ ] **Step 2: Run** `npx eslint .` → PASS; `npx vitest run --root server` + `npx vitest run` → PASS
- [ ] **Step 3: Commit** `docs: ai job match contract addendum and provider ADR`

## Execution order

Task 1 → 2 → 3 → 4 → 5 → 6 (strict; each consumes the previous `Interfaces`).

## Out of scope

- Client filter/search behavior change (none — client keeps semantics)
- Employer-side candidate matching, embeddings (approach B), landing `count = 0` fix (tracked as mock-remnant issue)
