# ADR-041 — AI provider layer and hybrid job matching

- **Status:** Accepted 2026-11-05
- **Plan:** `docs/superpowers/plans/2026-11-05-ai-job-matching-plan.md` (Plan A)
- **Spec:** `docs/superpowers/specs/2026-11-05-ai-job-matching-and-help-design.md` v1.1 §4
- **API contract:** Addendum E in `docs/arch/rework/02-api-contract.md`
- **Provider layer:** `server/src/aiProvider.js`
- **Does not supersede:** ADR-023 (`docs/arch/rework/07-ai-help-chat.md`) still governs `POST /api/ai/help`.

## Context

The Browse Jobs page already renders a client-filtered list of vacancies. The
"AI job matching" dialog was an honest placeholder: it sent nothing and ranked
nothing. What the page actually needs is an ordering plus a short reason per
card — enrichment over data the browser already has — not a new source of
truth, and not a failure mode that can empty the list.

The provider must also be replaceable without code changes: PESO may use
OpenRouter today and a different OpenAI-compatible endpoint (hosted or local
NVIDIA NIM) later, or no provider at all.

## Decision

### 1. One provider-agnostic, OpenAI-compatible layer

`server/src/aiProvider.js` is the shared layer for every matching provider
call: one native `fetch` to `POST {base}/chat/completions`. No SDK, no new
dependency, no browser-side key. ~~(`/api/ai/help` has not adopted it yet — see
the ADR-023 section below.)~~ **[superseded 2026-11-09: `/api/ai/help` now calls
this same layer via `callChat` (Plan B, commits `5a8d915`..`e08928a`) — see the
amended ADR-023 section below.]**

- Env is read **per call**, never at boot: a missing `OPENROUTER_API_KEY` must
  not stop the API from starting (the ADR-023 rule).
- `OPENROUTER_BASE_URL` defaults to `https://openrouter.ai/api/v1`.
  `OPENROUTER_MODEL` is used when set. The code default
  `openai/gpt-4o-mini` applies **only** while the base is OpenRouter's default;
  any other base must name its own model.
- `resolveConfig()` returns `{ key, base, model }`; `isConfigured()` is true
  only for a non-empty key; `callChat({ messages, maxTokens, timeoutMs })`
  returns `{ kind: 'OK', reply }` or `{ kind: 'UPSTREAM_FAILURE', status }` and
  never throws.
- Swapping providers is configuration only. `server/.env.example` carries the
  NVIDIA NIM recipe: `OPENROUTER_BASE_URL=https://integrate.api.nvidia.com/v1`
  plus an NVIDIA model id, with the warning that hosted NIM is prototype-grade
  at roughly 40 requests/minute.
- Logging is content-free: one line per call with the status class and latency
  (`OK`, `4xx`, `5xx`, `timeout`, `network`, `malformed`, `empty`, `budget`,
  `config`). Prompt, messages, reply, provider body, and headers are never
  logged.

### 2. Deterministic-first hybrid ranking

`server/src/matching/score.js` always ranks the whole live pool before any
provider is considered:

- Weights: skills **0.55**, barangay **0.20**, preferred-position title words
  **0.10**, recency **0.15**. A profile signal the seeker lacks is dropped and
  the remaining weights renormalize, so an empty profile degrades to a
  recency-only total order rather than ties.
- Recency is normalized inside the candidate pool (oldest → newest); no clock
  is read, so the scorer stays pure.
- Total order: score descending, then newest `created_at`, then id. Same input,
  same order, every time.
- Reasons for the deterministic top 30 are clause-built (`Skills match n of m`,
  `Same barangay`, `Title matches your preferred position`) with explicit
  fallbacks (`No profile signals matched`, `Ranked by posting date`), normalized
  and capped at 200 characters.

The LLM is then asked to re-rank **only the deterministic top 30**, with the
seeker's prompt (≤500 chars), an 8 s timeout, and `max_tokens` 1200. Model
output is untrusted:

- markdown-fenced JSON is tolerated;
- unknown, duplicate, and blank-reason ids are dropped; entries beyond 30 are
  truncated;
- reasons are control-character-stripped, whitespace-normalized, and capped at
  200 chars before they reach a card or the cache;
- every unranked live candidate is appended in deterministic order, so
  `ranking` still covers the entire pool.

`mode: 'ai'` is used only when a usable model ranking exists; otherwise the
response is `mode: 'deterministic'`. The client (`src/shared/services/ai.js`,
`src/features/job-seeker/OpportunityList.jsx`) only reorders its existing list. The server re-reads the
candidate ids with `status = 'published'`, so a vacancy closed while the list
was open silently drops out instead of being ranked.

### 3. Every AI failure degrades; none becomes an HTTP error

| `status` | Trigger |
|---|---|
| `config` | no key, or a custom base with no model — fails fast, no request, no budget spent |
| `budget` | the process-wide 20-calls/60 s budget is exhausted — no request |
| `timeout` | `AbortSignal.timeout` fires (8 s from the match route) |
| `network` | fetch threw (DNS, TLS, connection reset) |
| `4xx` / `5xx` | upstream non-OK, including 401/403/404/429; the body is cancelled, never read |
| `malformed` | the response body is not JSON |
| `empty` | no `choices[0].message.content`, or it is blank |

A route-level parse failure (non-array, unparseable, or no usable entry) takes
the same path. The route catches all of it and returns the deterministic result
with HTTP 200. A database failure is the expected 500; provider failures are
never an error response.

Why: the deterministic ranking already answers the question for every live
candidate; the provider pass only improves the order and adds prose. An error
status would make the page discard a perfectly good list. `/api/ai/help` is
different — it has no deterministic answer — so it keeps its 502/503 contract.

### 4. In-process cache, limiter, single-flight, global budget

- **Cache** (`server/src/matching/matchCache.js`): 15-minute absolute TTL, LRU
  cap 300 entries. Key = SHA-1 of `[userId, normalized prompt, sorted
  candidate ids]`, so candidate order never changes the key. A hit is replayed
  as-is (original `generatedAt`), never re-stored.
- **Limiter** (`jobMatchLimiter` in `server/src/middleware/rateLimit.js`):
  30 cache misses per 15 minutes per user (`req.user?.id || ipKeyGenerator(req.ip)`),
  applied after `auth`. The library-native `skip` exempts live cache hits; the
  general `apiLimiter` (300/15 min) still counts every call.
- **Single-flight** (`server/src/routes/aiMatch.js`): identical concurrent
  misses share one promise per cache key, so a burst costs one provider call.
- **Global budget** (`server/src/aiProvider.js`): 20 provider calls per rolling
  60 s **per process**, across all users; the 21st returns `budget` without a
  network call. Rejected calls do not extend the window.

All four are process-local. That is accepted only under ADR-037 — see
`docs/arch/adr-037-production-api-single-node.md`: the API runs as one
persistent Node process. Two replicas would mean two caches, two limiter
buckets, no cross-replica single-flight, and an uncoordinated N×20 calls/min
ceiling. Scale-out requires a shared store (Postgres/Redis) for cache and
counters **before** adding replicas; "just add replicas" is still forbidden.

### 5. Free-tier quotas and data policy (operator notes)

- Cost control is layered: 30 misses/15 min/user, one provider call per
  distinct question per 15 min (cache), single-flight for bursts, and a hard
  20 calls/min/process ceiling. A repeated question does not re-bill.
- The payload contains the seeker's typed preference text and public job
  fields only. It contains no seeker identity, profile row, resume, or
  application data. Treat the prompt as personal data anyway: it is free text
  and the dialog warns against entering personal details.
- Free/consumer tiers may retain prompts or train on them. Before pointing
  production at any provider, the operator must review that provider's
  retention and training terms, prefer a no-training or paid tier, or use a
  self-hosted OpenAI-compatible endpoint where payloads stay inside the
  deployment. Because the swap is env-only, this is a configuration decision,
  not a code change.
- The key stays server-side (`OPENROUTER_API_KEY`, never a `VITE_*` value) and
  `.env` is never committed.

## ADR-023 remains valid for `/api/ai/help`

This ADR does not change the help-chat contract. `POST /api/ai/help` keeps the
ADR-023 shape — 10 s timeout, 200 `{ reply }`, 400 `BAD_REQUEST`, 429 via
`aiLimiter` (20/15 min), 502 `UPSTREAM_ERROR`, and 503 `AI_NOT_CONFIGURED` — but
~~keeps the ADR-023 scope (role `job-seeker` today)~~ **[superseded 2026-11-09:
serves `job-seeker`, `employer`, `super-admin` via `Object.hasOwn(BRIEFS, role)`]**,
and ~~Addendum D in `docs/arch/rework/02-api-contract.md` remains the canonical
shape~~ **[superseded 2026-11-09: Addendum F is now the canonical shape]**.
Help also runs on this ADR's shared provider layer and shares its process-wide
20-calls/60 s budget with job-match (exhaustion → 502 `UPSTREAM_ERROR` for help).

One provider bug is fixed at the shared layer: a custom base with no model used
to produce a request with an empty/undefined model and a guaranteed upstream
4xx. `resolveConfig()` now resolves `model: null` for that case, logs one
warning per process, and `callChat` refuses to call; the match route also gates
on `resolveConfig().model`. ~~`/api/ai/help` still has its own inline fetch in
`server/src/routes/ai.js`; moving it onto the shared layer (and answering 503
for an unresolvable model) is the separate role-aware help plan
(`docs/superpowers/plans/2026-11-05-role-aware-help-plan.md`), not this ADR.~~
**[shipped 2026-11-09 (Plan B, commits `5a8d915`..`e08928a`): `/api/ai/help` now
calls `callChat` from `server/src/aiProvider.js` and answers 503 `AI_NOT_CONFIGURED`
for an unresolvable/model-less config; see the amended ADR-023 (`07-ai-help-chat.md`)
and Addendum F.]**

## Consequences

- Zero new dependencies and no schema change.
- A provider outage costs at most one 8 s wait per cache miss; repeats are
  served from cache and the page never loses its list.
- Deterministic quality is bounded by the seeker's profile fields; an empty
  profile is ordered by recency alone.
- Model reasons are generated text: sanitized, capped, and rendered verbatim,
  but never verified against the posting. They are not facts.
- No embeddings or semantic similarity (spec approach B); matching is tag and
  title-word overlap plus location and recency.
