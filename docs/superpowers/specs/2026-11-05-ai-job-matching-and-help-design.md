# AI Assistants Design — Hybrid Job Matching + Role-Aware Help Assistant

**Date:** 2026-11-05 · **Status:** Approved v1.1 (ranking-only contract) · **Owner:** Lead Architect
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

**Amendment v1.1 (2026-11-05):** Browse Jobs performs its filtering, search, and pagination **in the client** (`OpportunityList` fetches all published jobs once via `listJobs({pageSize: 200})` and computes `records` locally). To preserve exactly one filter implementation, the endpoint is a **ranking service over candidate IDs**, not a server-side filtered list.

**Request** `{ prompt: string, candidateIds: string[] }`
- `prompt` normalized, 1–500 chars, no control characters.
- `candidateIds` — ids of the client's currently open & accredited base pool (deduped, capped at 200 — the `pageSize: 200` cap); every entry is a validated uuid.

**Response 200**
```json
{ "mode": "ai" | "deterministic",
  "ranking": ["<jobId>", "…"],
  "reasons": [{ "jobId": "…", "reason": "Skills match 3 of your 5 · Same barangay" }],
  "generatedAt": "…" }
```
- `ranking` covers **every live candidate**, complete and ordered: the AI (if it succeeds) re-ranks the deterministic top 30; remaining candidates keep deterministic order. The client keeps all of its own filters/search/pagination and reorders `records` by this ranking — nothing about the client's job objects changes, so saved/apply affordances and pagination semantics are untouched.
- `reasons` exist only for the ranked top 30 (`ai`: model reasons; `deterministic`: server-generated). Cards without a reason row need none.
- Live-only: the server re-loads candidates by id (`status = 'published'`); ids that left the published state since the client's fetch simply receive no ranking row and are dropped by the client's existing open-jobs filter.
- **Errors:** 400 `BAD_REQUEST` (shape/violations), 401/403 per existing auth, 429 `RATE_LIMITED` per limiter. **No 503 and no other error ever originates from provider state** — provider problems produce `mode: 'deterministic'` 200s with the complete deterministic ranking.

### Pipeline (on cache miss only)

1. Load seeker profile signals — `job_seekers.skills text[]`, `barangay_district`, `preferred_position` (one `SELECT`).
2. Deterministic scorer (pure module `server/src/matching/score.js`, unit-testable): skills/tags overlap **0.55** · barangay match (`profile.barangay_district` vs `job.location`) **0.20** · preferred-position/title affinity **0.10** · recency **0.15**. (v1.1: the drafted `employment type` and `salary fit` weights are dropped — the seeker profile stores no such columns.) Signals the profile lacks are dropped with weights redistributed; an empty profile still yields recency ordering.
3. If `OPENROUTER_API_KEY` is configured (and global guard open): **one** chat call over the top-30 candidates' public fields (title, company, barangay, employment type, salary, tags, ≤300-char description excerpt) — system prompt demands a strict ordered JSON array `[{jobId, reason}]`; `max_tokens` ~1200; 8 s timeout. Parse tolerantly: strip markdown code fences; ignore unknown or duplicate ids; truncate beyond 30; entries can be a **subset** (unranked candidates are appended in deterministic order — jobs are never dropped). `reason` normalized + capped at 200 chars of plain text (no newlines, control chars, URLs, or markdown).
4. Any failure in step 3 → `mode: 'deterministic'` over the **full live pool** (server-generated reasons for the top 30).
5. Build `ranking` = [model order…] + [remaining live candidates in deterministic order]; cache it; respond.

### Caching, limiting, races

- Cache: in-memory Map, key `userId | hash(normalize(prompt)) | hash(sorted+joined candidateIds)` (**client filters and pagination are implied by the pool, not stored**), TTL 15 min, LRU cap ~300 entries.
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
| Limiter exhausted (30 misses/15 min) | 429; client clears AI ranking, shows standard-ordering notice |
| Auth expired mid-request | existing 401 contract |

### Client behaviour

- When a prompt is active, `OpportunityList` calls the endpoint with its base-pool ids; on 200 it orders `records` by `ranking` and renders `reasons` per card. On any non-200 it keeps the existing behavior (standard ordering) and shows one discreet notice ("AI matching is unavailable right now — showing standard results.").
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
- Free hosted NIM is prototype-grade; production exit = env swap to a paid/keyed provider or approach B (embeddings) — **the client-visible contract (`{mode, ranking, reasons}`) is designed to stay unchanged for an embeddings implementation.**
- Fuzzy prompt dedup is intentionally absent (normalization only); paraphrases legitimately produce fresh AI calls.

## 9. Files sketch (for the implementation plan; no code in this spec)

Suggested split into two implementation plans: **Plan A (matching)** and **Plan B (help assistant)**, or one plan in two phases.

- Server: `aiProvider.js` (new) · `ai/briefs.js` (new) · `matching/score.js` + `matching/matchCache.js` (new, pure) · `routes/aiMatch.js` (new endpoint) · `routes/ai.js` (brief map for help) · `middleware/rateLimit.js` (`jobMatchLimiter`, cache-miss-aware) · `app.js` (mount).
- Client: `shared/services/ai.js` (`matchJobs`) · `PreferenceMatching.jsx` (states/copy) · `OpportunityList.jsx` (ranking reorder, stale-response guard, notice) · `shared/components/HelpChat.jsx` (moved) · `TopNavLayout.jsx` (mount, auth-gated) · `JobSeekerLayout.jsx` (mount removed).
- Client: `shared/services/ai.js` (`matchJobs`) · `PreferenceMatching.jsx` (states/copy) · `OpportunityList.jsx` (data-source switch, stale-response guard, notice) · `shared/components/HelpChat.jsx` (moved) · `TopNavLayout.jsx` (mount, auth-gated) · `JobSeekerLayout.jsx` (mount removed).
- Docs/env: `server/.env.example` (NVIDIA recipe + provider policy comments), `docs/arch/rework/02-api-contract.md` addendum, new ADR (provider-agnostic AI + fallback + single-instance state), ADR-023 superseded sections marked.

## 10. Open risks

- Free-tier volatility beyond our control (quota/credit changes observed industry-wide) — mitigated by fallback-first design and mode logging.
- Model quality of AI reasons varies by provider/model; reasons are presentational, ranking authority stays with server validation.
- Supabase session expiry during long ranking — handled by existing 401 flow.

---
*Spec self-review performed inline (no placeholders, contract pinned, scope: two features in ≤2 plans). Implementation must go through the writing-plans skill after spec approval.*
