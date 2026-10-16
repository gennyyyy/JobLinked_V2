# Phase 2 Synthesis — Bug Hunting & Unit Testing

**Date:** 2026-10-15  
**Status:** Complete — 5 agents, all reports in

---

## Test Suite Status

| Metric | Value |
|--------|-------|
| Test files | 95 |
| Tests passing | 561 |
| Failing / skipped | 0 / 0 |
| `npm test` | exit 0 |
| `npm run lint` | exit 0 |
| Flakiness | None — 4 consecutive runs identical |

**Tests added this phase:** 76 frontend cases (15 files) + 53 backend HTTP integration tests (9 suites) + 2 broken tests repaired.

**⚠️ Moving target warning:** Parts of the working tree are uncommitted. Re-run `npm test` immediately before any merge gate.

---

## Bug Register (15 findings from debugger)

| ID | Severity | Bug | Location | Fix |
|----|----------|-----|----------|-----|
| B1 | Medium | Employer email verification lands on job-seeker callback | `services/auth.js:130` + `AuthCallback.jsx:27` | Route by role in callback |
| B2 | Medium | Admin role move one-way — 500s on move-back | `admin.js:589-592` | Delete old role row, don't deactivate |
| B3 | Medium | Deadline bypass server-side | `applications.js:44-46` | Add `deadline >= current_date` check |
| B4 | Low-Med | Concurrent resume uploads → 500 + orphan file | `upload.js` / resumes | Unlink on 23505 |
| B5 | Low | Non-UUID path params → 500 | ~28 handler sites | Validate in `loadX` helpers |
| B6 | Low | Enum query filters → 500 | jobs/admin list routes | Allowlist validation |
| B7 | Low | Unbounded `page` → 1e+21 offset | jobs pagination | Clamp/pageSize guard |
| B8 | Low | Array `skills` param TypeError | jobs search | Handle array type |
| B9 | Low | CSV export without quote escaping | reports | Escape `"` as `""` |
| B10 | Low | Retention `setMonth` drift | admin retention | Use interval arithmetic |
| B11 | Low | Provision double-submit 500 | auth provision | Catch 23505 |
| B12 | Low | Audit-log date filter coercion | admin | Validate date format |
| B13 | Low | Admin email-edit desync | admin users patch | Re-validate uniqueness |
| B14 | Low | Stale-profile race in AuthProvider | AuthProvider.jsx | Guard stale response |
| B15 | Low | Unescaped LIKE wildcards | admin search | Escape `%`/`_` |

## Error Handling Gaps (from error-detective)

| ID | Severity | Gap | Location | Fix |
|----|----------|-----|----------|-----|
| S1 | High | Malformed UUID → 22P02 → 500 (not 400/404) | ~28 sites, fix in `loadX` | UUID guard in load helpers |
| S2 | Medium | 413 → 500 (handler only maps 400) | `index.js:45` | Map `e.status === 413` too |
| S3 | Medium | upload.js bypasses `err()` | `upload.js:36-41` | Use `err()` |
| S4 | Medium | Accreditation.jsx — 6/7 mutations no try/catch | `:32,41,150,162,192,199,208` | Add catch + error state |
| S5 | Low | Applicants.jsx shared error state unmounts list | `:51-62` | Per-action error state |
| S6 | Low | Unguarded transaction rollback | D1 sites | `withTransaction` helper |
| S7 | Low | Supabase client built at module scope | `server/src/auth.js` | Lazy `supa` getter |

---

## Verified Clean (negative results — do not re-investigate)

- Duplicate-application guard (TOCTOU-safe via DB unique constraint)
- Status-transaction history writes (same transaction asserted)
- Resume activate swap (unique index)
- SQL injection surface (all parameterized + allowlisted identifiers)
- api.js 401 retry path (straight-line, no loop — tested)
- Best-effort notification fan-out catches

---

## Coverage Gaps Found (29 of 100 source files untested)

Highest-value omissions:
- `PublicJobs.jsx` / `PublicJobDetail.jsx` — only public unauthenticated journeys
- `server/src/upload.js` — trust boundary
- `server/src/rateLimit.js` — abuse protection
- `server/src/util.js` — error shapes + fan-out used everywhere

---

## Phase 2 Exit Criteria

- [x] Backend test infrastructure established
- [x] 561 tests green, lint clean
- [x] 15 bugs documented
- [x] 7 error handling gaps documented
- [x] Coverage gaps identified
- [ ] **Bugs fixed** (handoff to fixer phase)
- [ ] **Error gaps closed** (handoff to fixer phase)

## Handoff Decision

15 bugs + 7 error gaps = 22 fixable issues. Dispatch a single **fixer agent** with the consolidated bug register to apply all fixes in one coherent pass, then re-run tests. This avoids N sequential agents for one-line fixes.

---

*End of Phase 2 Synthesis*
