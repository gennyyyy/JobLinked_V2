# ADR-023 — Job-seeker AI help chat (server-mediated OpenRouter) [SIGNED OFF 2026-10-13]

Scope: general "how do I…" help about PESO JobLinked, for the `job-seeker`
role only. This is **not** job matching — `AiMatchModal.jsx` stays a separate,
still-unwired feature (see follow-up task below).

## Decision

The browser never calls an LLM. All LLM traffic goes through one new endpoint
on the Express API, so the provider key stays server-side (AGENTS.md forbids
client-side secrets) and role/cost control lives in one place.

- **Transport:** one native `fetch` to OpenRouter's OpenAI-compatible
  `POST {base}/chat/completions`. No SDK, no new dependency anywhere.
- **Trust boundary:** `auth` + `requireRole('job-seeker')` — both already exist
  (`server/src/auth.js:61`). Every other role is 403.
- **No data access:** the endpoint reads no tables and echoes no personal data.
  The prompt is the conversation plus one static help brief.
- **Rejected:** browser-side provider call (leaks the key); vendor SDK (one POST
  does not justify a dependency); RAG/vector store (a fixed help brief answers
  "how do I…" questions and is the whole knowledge base today).

## API contract

`POST /api/ai/help` — see Addendum D in `docs/arch/rework/02-api-contract.md`
for the canonical shape. Summary: body
`{ messages: [{ role, content }] }` (last entry `user`), 200 `{ reply }`,
errors `{ error: { code, message } }` with `400 BAD_REQUEST`,
`401`/`403`, `429 RATE_LIMITED`, `502 UPSTREAM_ERROR`, `503 AI_NOT_CONFIGURED`.

## Config

`server/.env` (+ `.env.example`): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
`OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`). The key is
**not** added to `env.js`'s required list — a missing key must not stop the API
booting; that request returns 503 instead.

## Work breakdown (handoff)

Ordered; backend and frontend are independent and may run in parallel against
this contract.

1. **backend** — `server/src/routes/ai.js` (router, validation, `HELP_BRIEF`
   const, provider call with 10s `AbortController`), mount in
   `server/src/index.js`, `aiLimiter` in `server/src/middleware/rateLimit.js`
   keyed `req.user?.id || req.ip` and applied inside the route **after** `auth`.
   Test: `server/src/routes/ai.test.js` (pattern: `reports.export.test.js`).
2. **frontend** — `src/shared/services/ai.js` → `askHelp(messages)` via
   `api.post('ai/help', { messages })`; `src/features/job-seeker/HelpChat.jsx`
   (floating Help button + panel, local transcript, sends last ≤10 turns,
   loading/error/retry, dialog a11y patterned on `AiMatchModal`); mount once in
   `src/features/job-seeker/JobSeekerLayout.jsx`. Test:
   `src/features/job-seeker/__tests__/HelpChat.test.jsx`.
3. **review** — verify both sides against this contract before merge.

## Non-goals

No streaming (the shared `lib/api.js` client parses JSON only), no persisted
chat history (would need a schema change and its own approval), no per-user
memory, no answers about the seeker's own account data.

## Follow-up (separate task, not this ADR)

Audit whether the browse-jobs AI matching can take the same OpenRouter key.

## ponytail ceilings

- `HELP_BRIEF` lives in the route file; split into its own module when it
  outgrows one screen.
- `aiLimiter` uses the existing in-memory store; move to a Redis store if the
  API ever runs multi-instance.
