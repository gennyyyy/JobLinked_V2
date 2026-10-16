# Master Orchestration Plan — Project Perfection & Exhaustive QA

**Date:** 2026-10-15  
**Orchestrator:** Lead Architect  
**Mode:** Full orchestration (user-selected Option B)  
**Project:** JobLinked (PESO Santa Maria)

---

## Phase 1 Summary (Complete)

Three audit reports + six agent definitions produced:

| Report | Key Output |
|--------|-----------|
| Architectural Audit | 10 findings (3 Critical, 6 High, 8 Medium, 7 Low) + scalability assessment |
| Pattern Review | Scorecard + 9 duplication items (D1–D9) + prioritized structural recommendations |
| Context Map | File inventory, 9 data flows, auth flow map, test coverage gaps, config surface |
| Agent Definitions | 6 specialized agents (backend-tester, frontend-tester, security-auditor, performance-engineer, ui-reviewer, phase-coordinator) |

---

## Consolidated Finding Register

### Critical (P0 — must fix)

| ID | Finding | Effort | Source |
|----|---------|--------|--------|
| C1 | No rate limiting on general API routes (only `/api/auth` + uploads throttled) | S | Audit |
| C2 | Unbounded queries on all admin list endpoints (no pagination) | M | Audit |
| C3 | No security headers (helmet missing) | S | Audit |

### High (P1)

| ID | Finding | Effort | Source |
|----|---------|--------|--------|
| H1 | No compression middleware | S | Audit |
| H2 | Heavy frontend libs (mammoth ~2MB, pdfjs-dist ~1MB) not lazy-loaded | M | Audit |
| H3 | Missing DB indexes: `job_applications(applied_at)`, `job_vacancies(deadline)`, `notifications(created_at)` | S | Audit |
| H4 | No request validation library — inconsistent hand-rolled validation | M | Audit |
| H5 | No structured logging/observability (console.error only) | M | Audit |
| H6 | Express 4 instead of Express 5 | M | Audit |

### Medium (P2–P3)

| ID | Finding | Effort | Source |
|----|---------|--------|--------|
| M1 | Inconsistent pagination (employer jobs endpoint) | S | Audit |
| M2 | N+1 pattern in admin users (3 queries, JS sort) | S | Audit |
| M3 | No soft delete for most entities | L | Audit |
| M4 | No CSRF protection (low risk with Bearer tokens — document) | S | Audit |
| M5 | No connection pool tuning (default max: 10) | S | Audit |
| M6 | Shallow health check (only `select 1`) | S | Audit |
| M7 | `persistSession: false` UX trade-off (document) | S | Audit |
| M8 | No retry logic for transient failures in api.js | M | Audit |
| D1 | Transaction boilerplate ×8 → `withTransaction()` helper | S | Pattern |
| D2 | Role-union query ×2 → consolidate `resolveUser()` | S | Pattern |
| D3 | Job status writer ×2 → shared helper | S | Pattern |
| D4 | Seeker JSON projection ×5 across 3 files → `queries.js` | S | Pattern |
| D5 | Job constant sets ×2 → single source | S | Pattern |
| D6 | Ownership guards ×10 → `loadOwned*()` helpers | M | Pattern |
| AP-1 | God router `admin.js` (604 lines, ~8 domains) | L | Pattern |
| AP-3 | `/notifications/*` routes misplaced in admin router | S | Pattern |
| AP-5 | Error contract bypassed in `upload.js` | S | Pattern |

### Low (P4)

| ID | Finding | Effort | Source |
|----|---------|--------|--------|
| L1 | No API versioning | S | Audit |
| L2 | No CORS preflight caching | S | Audit |
| L3 | No request/correlation ID | S | Audit |
| L4 | No migration framework | M | Audit |
| L5 | No backend test coverage | L | Audit |
| L6 | No Docker/containerization | M | Audit |
| L7 | No CI/CD configuration | S | Audit |

---

## Architecture Decisions Made

### ADR-025 (Ratified) — Backend Shared Helpers, Stay Thin

**Decision:** Extract shared helpers (`withTransaction`, `resolveUser`, `queries.js` fragments, `loadOwned*` guards) into `server/src/util.js` and `server/src/queries.js`. **Do NOT** introduce controller/service/repository layers.

**Rationale:** The pattern review's own recommendation (option 1). The codebase deliberately chose documented minimalism under ADR-020. The real debt is duplication (D1–D9), not layering. Adding 6+ files of indirection for a ~7-route API would be speculative scaffolding.

### ADR-026 (Ratified) — Admin Router Decomposition

**Decision:** Split `server/src/routes/admin.js` into `routes/admin/` sub-routers (`users.js`, `moderation.js`, `reference.js`). Move `/notifications/*` to `routes/notifications.js`. Enforce 300-line-per-file budget.

**Rationale:** 604-line god router with ~8 domains is the single biggest maintainability drag. Split is mechanical (no behavior change).

---

## Execution Plan

### Phase 2 — Exhaustive Bug Hunting & Unit Testing

**Agents:** `tester`, `test-automator`, `test-generator`, `debugger`, `error-detective`

**Tasks:**
1. Establish backend test infrastructure (Vitest + supertest in `server/`)
2. Write integration tests for all API endpoints (auth, jobs, applications, profiles, admin, reports, AI)
3. Write unit tests for untested utility functions
4. Expand frontend test coverage for untested components
5. Hunt for edge cases, race conditions, type-coercion bugs

**Gate:** All tests pass, no regressions, `npm test` and `npm run lint` green.

### Phase 3 — UI/UX Perfection & Frontend Optimization

**Agents:** `ui-designer`, `ui-ux-designer`, `ux-researcher`, `frontend-developer`, `react-specialist`, `web-vitals-optimizer`

**Tasks:**
1. Audit all screens for visual consistency and WCAG 2.1 AA compliance
2. Optimize Core Web Vitals (LCP, FID/INP, CLS)
3. Lazy-load heavy libraries (mammoth, pdfjs-dist)
4. Test responsive behavior across viewports
5. Polish animations and transitions

**Gate:** Lighthouse ≥ 90 all categories, zero WCAG AA violations.

### Phase 4 — Massive Concurrency Simulation & Backend Hardening

**Agents:** `devops-engineer`, `backend-architect`, `database-optimizer`, `supabase-realtime-optimizer`, `network-engineer`, `incident-responder`

**Tasks:**
1. Apply Critical security fixes (C1, C2, C3)
2. Apply High-priority performance fixes (H1, H3, H5)
3. Apply DB migration for new indexes
4. Load test with 1,000+ concurrent users
5. Monitor event loop, DB connections, memory
6. Tune connection pool based on results

**Gate:** 1,000 concurrent users, p95 < 500ms, zero crashes, no memory leaks.

### Phase 5 — Penetration Testing & Security Audit

**Agents:** `security-auditor`, `penetration-tester`, `api-security-audit`, `cyber-security-expert`

**Tasks:**
1. SQL injection attempts on all endpoints
2. XSS testing (stored, reflected, DOM-based)
3. CSRF analysis
4. Prototype pollution testing
5. Rate-limit bypass testing
6. Auth bypass / privilege escalation attempts
7. File upload security (path traversal, type confusion)
8. Secrets audit (no service-role keys in client code)

**Gate:** Zero critical/high vulnerabilities. All findings patched.

### Phase 6 — Code Review, Debt Eradication & Final Polish

**Agents:** `code-reviewer`, `unused-code-cleaner`, `review-agent`, `performance-profiler`, `error-detective`

**Tasks:**
1. Apply all refactors (D1–D9, AP-1, AP-3, AP-5)
2. Remove unused code and dependencies
3. Remove console.log statements
4. Enforce JSDoc on public interfaces
5. Final lint + test pass
6. Bundle size audit

**Gate:** `npm run lint` clean, `npm test` green, no unused deps, no console.logs.

---

## Status

- [x] Phase 1 — Architectural Audit & Master Planning
- [ ] Phase 2 — Bug Hunting & Unit Testing
- [ ] Phase 3 — UI/UX Perfection & Frontend Optimization
- [ ] Phase 4 — Concurrency Simulation & Backend Hardening
- [ ] Phase 5 — Penetration Testing & Security Audit
- [ ] Phase 6 — Code Review, Debt Eradication & Final Polish
