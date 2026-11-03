# ADR-037 — One REST client, one mapper layer, SWR per resource [ACCEPTED 2026-11-03]

## Context
The moved Next app gets all data from an in-memory/localStorage mock (`services/mock/*`) through
`useDemo()`, with unused `services/api/http.ts` + `contracts.ts` scaffolding whose paths only
partially match the real Express API. The old Vite app has a single well-behaved client
(`src/shared/lib/api.js`: bearer header, query building, 401 refresh-and-retry) but fetches ad hoc
inside components.

Two data layers is the failure mode this migration must not ship.

## Decision
Three layers, each with one owner:
1. **`services/api/client.ts`** — the only `fetch` in the app. Owns base URL
   (`NEXT_PUBLIC_API_URL`, dev fallback `http://localhost:4000`), bearer header, query building
   (omits `undefined`/`null`/`''`), JSON vs `FormData`, `204 → null`, the error envelope
   (`ApiError(message, status, code)`), the one 401 policy, and a blob helper for file previews.
2. **`services/mappers.ts`** — snake_case API rows → the camelCase domain types the components
   already use, including every enum translation table and date-only deadline handling.
3. **`hooks/queries.ts`** — SWR with one key per resource (`['jobs', filters]`, `['me']`, …);
   mutations `mutate()` the keys they affect. Components contain no `fetch`, no path strings, no
   enum logic.

The mock layer (`services/mock/**`, `use-demo.ts`, `DemoSwitcher`, demo accounts) is deleted in the
same migration — **no dual mode**, no feature flag.

## Consequences
- One place to change when the API contract changes; one place to test the 401 path.
- Every mapper and the client get Vitest coverage (enums exhaustively, unknown values fall back to
  the raw value with a neutral label rather than `undefined`).
- Deleting the mock is a hard cutover: each screen must be wired before the mock files are removed
  (the deletion is the last wiring task, not the first).
- Server components do not fetch user data (ADR-036); SWR runs in client components.

## Alternatives
- **Per-resource fetch wrappers** (the `contracts.ts` direction) — many near-identical clients, no
  single 401 policy. Rejected.
- **React Query / TanStack** — equivalent capability, extra dependency; SWR is already in the app
  and smaller. Rejected.
- **Keep the mock behind a flag** — guarantees drift and untested code paths. Rejected.
