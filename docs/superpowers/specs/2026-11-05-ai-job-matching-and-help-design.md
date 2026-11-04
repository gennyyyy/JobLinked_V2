# AI Assistants Design — Hybrid Job Matching + Role-Aware Help Assistant

**Date:** 2026-11-05 · **Status:** Draft for user review · **Owner:** Lead Architect
**Scope:** two features under one shared provider layer: (1) real AI job matching for the job-seeker portal (replacing the current placeholder), (2) activating the dormant help assistant across all three portal roles.

## 1. Outcome & success criteria

- A job seeker types a free-text preference in the existing dialog and gets an **AI-ranked, explained** list of published vacancies. No placeholder copy remains.
- The help assistant answers **how-do-I** questions for job seekers, **employers**, and **super-admins**, each with its own factual brief.
- **Cost-free operation** within free provider tiers (NVIDIA build.nvidia.com preferred; Groq / Gemini free tier / OpenRouter free models acceptable).
- When any AI dependency fails — no key, expired key, wrong model, quota exhausted, bad output, timeout — the **page never breaks**: matching silently degrades to deterministic ranking; help shows a plain fallback line.
- Success measures: p50 AI-ranked page < 6 s; 0 contract violations in tests; zero PII fields in any upstream payload (asserted by test); deterministic fallback exercised in tests; all existing suites stay green.

## 2. Current state (verified 2026-11-05)

- `PreferenceMatching.jsx` (job-seeker) is an honest placeholder: *"No actual AI service is connected."* The prompt only keyword-filters the current `OpportunityList` page.
- The help assistant exists end-to-end (`HelpChat.jsx` + `POST /api/ai/help` + tests + API contract addendum, ADR-023) but is inert: `server/.env` has no `OPENROUTER_API_KEY` → `503 AI_NOT_CONFIGURED`. Known audit findings to fix: `OPENROUTER_MODEL` unset → provider 400 → generic 502; no DPA/privacy note for the third-party processor.
- `server/src/routes/ai.js` already proxies OpenAI-compatible upstreams via `OPENROUTER_BASE_URL` / `OPENROUTER_MODEL` / `OPENROUTER_API_KEY`. **NVIDIA NIM (`https://integrate.api.nvidia.com/v1`) is OpenAI-compatible, so provider choice is configuration, not architecture.**
- Related but out of scope here (tracked separately as mock-data remnants): the landing-page `const count = 0` hardcoded stat, "sample/fictional" remaining copy — not this spec.

## 3. Shared provider layer

New `server/src/aiProvider.js` (zero dependencies):

- `resolveConfig()` — reads `OPENROUTER_*` env per request (same policy as ADR-023: a missing key must not stop booting).
- `callChat({ messages, maxTokens, timeoutMs })` — one `fetch` to `{base}/chat/completions` with `Authorization: Bearer`, `Signal.timeout`, uniform error taxonomy: any non-OK upstream (400/401/403/404/429/5xx), empty content, timeout, or truncated/malformed body → `{ kind: 'UPSTREAM_FAILURE' }`; the **routes decide fallback semantics** (see §4/§5). No provider detail is ever leaked to clients.
- Shared in-process **global provider RPM guard**: a simple per-minute counter across both endpoints (target ≤ 20 calls/min per Node process, headroom under the 40 RPM free key). When the guard is open, calls are made; when exhausted → treat as upstream failure. Documented single-instance caveat (same class as `aiLimiter`, ADR-037 single-process invariant).
- `normalize(text)` — trim + collapse internal whitespace; used for prompts and reasons before caps.

## 4. Feature 1: AI job matching

### Contract

`POST /api/ai/job-match` — `auth` + job-seeker only + `jobMatchLimiter` (see below).

**Request** `{ prompt: string, filters: {...}, page: number, pageSize: number }`
- `prompt` normalized, 1–500 chars, no control characters.
- `filters` is the **same whitelist and validation as `GET /api/jobs`** (query, barangay, category, type, salary, experience + same caps on `page`/`pageSize`) — one implementation, reused, not duplicated.

**Response 200**
```json
{ "jobs": [...], "total": 143, "page": 1, "pageSize": 12,
  "match": { "mode": "ai" | "deterministic",
             "reasons": [{ "jobId": "…", "reason": "Skills match 3 of your 5 · Same barangay" }],
             "generatedAt": "…" } }
```
- `jobs` are produced by the **same serializer/annotation path as `GET /api/jobs`** (saved state, apply affordances) — never hand-built job objects.
- `total` = count of published jobs matching the filters (identical to GET semantics). Pages beyond the ranked pool are served in deterministic order, so pagination is stable for the cache lifetime.
- **Errors:** 400 `BAD_REQUEST` (shape/stem violations), 401/403 per existing auth, 429 `RATE_LIMITED` per limiter. **No 503 and no other error ever originates from provider state** — provider problems produce `mode: 'deterministic'` 200s.

### Pipeline (on cache miss only)

1. Load seeker profile signals (skills, preferred barangay/location, preferred employment type) — server-side from DB.
2. Query published jobs matching filters; deterministic scorer (pure module `server/src/matching/score.js`, unit-testable):
   skills overlap 0.55 · barangay/location 0.20 · employment type match 0.10 · recency 0.10 · salary fit 0.05. Components with no available signal (e.g., profile has no skills yet) are dropped and their weight redistributed; an empty profile still yields recency/type ordering. Ranked pool capped at **30**.
3. If `OPENROUTER_API_KEY` is configured (and global guard open): **one** chat call — system prompt instructs a strict ordered JSON array `[{jobId, reason}]`; `max_tokens` ~1200; 8 s timeout. Parse tolerantly: strip markdown code fences; ignore unknown or duplicate IDs; truncate beyond 30; entries can be a **subset** (unranked candidates are appended in deterministic order — jobs are never dropped). `reason` normalized + capped at 200 chars of plain text (no newlines, control chars, URLs, or markdown).
4. Validate; any step failing → `mode: 'deterministic'` with server-generated reasons ("Skills match 3/5 · ...").
5. Cache the ranked pool (ID order + mode + reasons) and serve the requested page from it, then filter IDs whose left the published state at serve time (fresh liveness query) so a job unpublished mid-TTL cannot be clicked into a 404 — pool shrink may shorten the result list; documented.

### Caching, limiting, races

- Cache: in-memory Map, key `userId | hash(normalize(prompt)) | hash(filters)` (**page excluded**), TTL 15 min, LRU cap ~300 entries.
- `jobMatchLimiter`: **30 miss-calls / 15 min per user**, implemented to count only cache misses (a cache hit short-circuits before accounting), so paging an active result can never 429 mid-scroll.
- Single-flight: concurrent identical misses share one provider call (in-process promise map).
- Client last-write-wins: each request carries a client-side request id; stale resolutions are ignored (avoids out-of-order prompt overwrite).
- Upstream failures are logged as `logger.warn` (status class, latency, mode) — **never the message or prompt text**.

### Failure map (pinning the review finding)

| Event | Result |
|---|---|
| Key unset | 200 `deterministic` (no warning spam; logged once per boot) |
| Key set, model unset/unknown → upstream 400/404 | 200 `deterministic` + boot-time warning at first use |
| Expired/invalid key → 401/403 | 200 `deterministic` |
| 429 (provider or global guard) | 200 `deterministic` |
| 5xx / timeout / empty / malformed / truncated JSON | 200 `deterministic` |
| Invalid request shape | 400 `BAD_REQUEST` |
| Limiter exhausted (30 misses/15 min) | 429; client then re-fetches standard results (§6) |
| Auth expired mid-request | existing 401 contract |

### Client behaviour

- On any non-200 while AI mode is active: automatically re-fetch the standard results and show one discreet notice ("AI matching is unavailable right now — showing standard results"). The Browse page never enters a dead error state while a prompt is active.
- Rendering by mode: `deterministic` shows the existing explainable-ranking notice; `ai` shows the per-job reason and a compact "AI ranking" tag. A visible line in the dialog: **"Your request is processed by an AI provider to rank vacancies. Never include personal details; your name and resume are never sent."**

## 5. Feature 2: Role-aware help assistant

### Contract (additive on the existing endpoint)

`POST /api/ai/help` keeps: `auth`, `aiLimiter` (20 req / 15 min), ≤ 10 messages × 1000 chars, 10 s timeout, `502 UPSTREAM_ERROR`, `503 AI_NOT_CONFIGURED` (ADR-023 semantics unchanged).

Changes:
1. **All three roles served.** `requireRole('job-seeker')` is removed. Role comes from the **existing server-side auth middleware's DB-resolved role** (`req.user.role` from `server/src/auth.js`) — never from a client-decodable claim. Unknown role → 403.
2. **Role briefs** in `server/src/ai/briefs.js` (documentation only, feature-accurate, no account data):
   - `job-seeker` — today's brief (browse/apply/resume/profile/notifications).
   - `employer` — post & manage vacancies, accreditation process/questions, applicant pipeline, withholding decisions to PESO staff.
   - `super-admin` — accreditation review, user/role management, reports and audit trail usage.
   - Shared guard rows in all briefs: cannot see accounts/applications/reports; never fabricates PESO policy; off-topic → "contact PESO Santa Maria."
3. **Widget placement:** move `HelpChat` from `src/features/job-seeker/` to `src/shared/components/HelpChat.jsx` and mount it **once in `TopNavLayout`** (already role-aware). The old mount in `JobSeekerLayout` is removed (no double-mount). The widget renders **only for authenticated, provisioned users** (public visitors see nothing).
4. **Model fix:** default model resolved in code for OpenRouter-specific base; for other base URLs `OPENROUTER_MODEL` is required — boot warning when set base + missing model; at request time an upstream 404-class failure degrades per §4-map (help: friendly fallback, not silent).
5. **Widget UX:** friendly states for 503/429 ("The assistant isn't available right now. For help, contact PESO Santa Maria at …"); loading stays "Thinking…".
6. **Privacy:** dialog footer line — "Answers are generated by an AI provider. Don't include personal details here; nothing about your account is shared." Privacy notice gains a short third-party-processor paragraph (DPA mention per the security audit). Message content is not logged or persisted (unchanged).

### Testing (both routes)

`server/src/routes/ai.test.js` extended: validation, missing key, 401/403/404/429/5xx/timeout/malformed-JSON → deterministic (or friendly help fallback), ID-subset/dedupe/truncation enforcement, reason sanitation (control chars/length), cache hit/miss ordering vs limiter (miss-count only), single-flight, **payload lint test asserting no seeker PII fields in the upstream body**, role brief selection incl. 403 for unknown role, model-default warnings. Client: dialog states, data-source switch + stale-response ignore, TopNavLayout mount (auth-only rendering), brief-coded 503 fallback UI. If any existing test pins old copy ("No actual AI service is connected"), that test is updated in the same change.

## 6. Accessibility (pinned)

Dialog states are keyboard-reachable (existing `useDialog` handles trap/Escape/focus-return — reused); new: `aria-live="polite"` announcements for loading / mode switch / fallback; reasons are plain text in card body (screen-reader friendly); AI tag carries `title` + visible text (icon-only controls avoided).

## 7. Security & privacy decisions

- **Prompt injection via employer-authored job text:** system prompt isolates instructions; the model only ranks and produces bounded reasons; output is a permutation check over server-chosen candidates; reasons cannot carry markup/links. Job text remains employer-provided content of record.
- **User-typed PII:** matching dialog and help widget both carry "don't include personal details" guidance; briefs steer to PESO contact for anything sensitive; residual risk (user pastes PII anyway) accepted and recorded in ADR/privacy note.
- **Provider data policy:** prefer providers whose free terms don't train on inputs (NVIDIA/Groq); Gemini free tier documented as last-resort; decision recorded per deployment in `.env.example` comments.
- **Cost abuse:** per-user miss-limiter + global RPM guard + empty-key = zero network; single-instance guard scaled with ADR-037.
- **Observability:** mode distribution + fallback reasons in `logger.warn/info` (no content); enough to watch free-tier health without a metrics platform (ops plan's YAGNI monitoring decision).

## 8. Explicit trade-offs

- In-process cache/limiter/single-flight are single-instance state (matches existing deployment invariant; invalid if the API ever scales beyond one process — then move to Postgres-backed state, same as the rate limiter's documented next step).
- 15-min result freshness with serve-time liveness filtering is slightly fuzzy (page counts may shrink); accepted over per-page AI calls.
- Free hosted NIM is prototype-grade; production exit = env swap to a paid/keyed provider or approach B (embeddings) — **the client contract (`{jobs,total,page,pageSize,match}`) is designed to stay unchanged for an embeddings implementation.**
- Fuzzy prompt dedup is intentionally absent (normalization only); paraphrases legitimately produce fresh AI calls.

## 9. Files sketch (for the implementation plan; no code in this spec)

Suggested split into two implementation plans: **Plan A (matching)** and **Plan B (help assistant)**, or one plan in two phases.

- Server: `aiProvider.js` (new) · `ai/briefs.js` (new) · `matching/score.js` (new, pure) · `routes/ai.js` (extend: match endpoint; brief map for help) · `middleware/rateLimit.js` (add `jobMatchLimiter`, cache-miss-aware) · route registration.
- Client: `shared/services/ai.js` (`matchJobs`) · `PreferenceMatching.jsx` (states/copy) · `OpportunityList.jsx` (data-source switch, stale-response guard, notice) · `shared/components/HelpChat.jsx` (moved) · `TopNavLayout.jsx` (mount, auth-gated) · `JobSeekerLayout.jsx` (mount removed).
- Docs/env: `server/.env.example` (NVIDIA recipe + provider policy comments), `docs/arch/02-api-contract.md` addendum, new ADR (provider-agnostic AI + fallback + single-instance state), ADR-023 superseded sections marked.

## 10. Open risks

- Free-tier volatility beyond our control (quota/credit changes observed industry-wide) — mitigated by fallback-first design and mode logging.
- Model quality of AI reasons varies by provider/model; reasons are presentational, ranking authority stays with server validation.
- Supabase session expiry during long ranking — handled by existing 401 flow.

---
*Spec self-review performed inline (no placeholders, contract pinned, scope: two features in ≤2 plans). Implementation must go through the writing-plans skill after spec approval.*
