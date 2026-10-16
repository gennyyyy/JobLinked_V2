# Phase 1 — Architectural Audit Report

**Project:** JobLinked (PESO Santa Maria)  
**Date:** 2026-10-15  
**Auditor:** Lead Architect  
**Scope:** Read-only analysis of dependencies, backend, frontend, database, security, state management, error handling, and performance  

---

## Executive Summary

- **Solid foundational architecture** — ADR-020 (local Postgres + Supabase Auth, thin Express API) is well-executed with clean separation of concerns, parameterized SQL, and a consistent error contract.
- **Critical security gap: no rate limiting on general API routes** — Only `/api/auth` and upload endpoints are throttled. All other endpoints (jobs, applications, admin, reports) are unthrottled, leaving the API open to brute-force and enumeration attacks.
- **Missing pagination on all admin list endpoints** — `/admin/users`, `/admin/companies`, `/admin/jobs`, `/admin/applications`, `/admin/accreditations`, and `/admin/reports` return unbounded result sets. At 1,000+ users this will cause memory and latency blowups.
- **No request validation library** — All validation is hand-rolled and inconsistent across routes. Some endpoints validate thoroughly (auth/provision), others minimally (jobs POST only checks `title`). A shared validation layer would reduce bug surface.
- **Heavy frontend dependencies without code-splitting strategy for libraries** — `mammoth` (DOCX parsing) and `pdfjs-dist` (PDF rendering) are large bundles. They should be lazy-loaded only where needed.
- **No compression middleware** — API responses are uncompressed. JSON payloads for job lists and admin endpoints will be large at scale.
- **Database schema is well-designed** — Proper FK constraints, enum types, indexes on query patterns, and triggers for denormalized field sync. Minor gaps: missing indexes on `job_applications(applied_at)` and `job_vacancies(deadline)`.
- **Auth flow is sound** — Supabase JWT validation, role resolution from local tables, and token-only auth for provisioning. Session is not persisted (by design), with refresh handled client-side.
- **Error handling is consistent** — `{ error: { code, message } }` shape across all routes, centralized error middleware, and frontend ErrorBoundary. No retry logic for transient failures.
- **No structured logging or observability** — Only `console.error` for unhandled errors. No request logging, no metrics, no tracing. Debugging production issues will be difficult.
- **Scalability ceiling: ~500 concurrent users** — Single-instance Node.js with in-memory rate limiting, no caching, no connection pooling tuning, and unbounded queries. Horizontal scaling requires Redis for rate limiting and a CDN for static assets.

---

## Dependency Health Table

### Root (`package.json`)

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| `react` | ^19.2.8 | ✅ Current | React 19 stable |
| `react-dom` | ^19.2.8 | ✅ Current | |
| `react-router-dom` | ^7.18.2 | ✅ Current | v7 is latest major |
| `@supabase/supabase-js` | ^2.117.2 | ✅ Current | |
| `tailwindcss` | ^4.3.3 | ✅ Current | v4 is latest |
| `@tailwindcss/vite` | ^4.3.3 | ✅ Current | |
| `lucide-react` | ^1.48.0 | ✅ Current | |
| `mammoth` | ^1.13.0 | ⚠️ Heavy | ~2MB bundle; only needed for DOCX resume parsing |
| `pdfjs-dist` | ^6.4.299 | ⚠️ Heavy | ~1MB+ bundle; only needed for PDF resume rendering |
| `vite` | ^8.2.0 | ✅ Current | v8 is latest |
| `vitest` | ^4.1.4 | ✅ Current | |
| `eslint` | ^10.8.0 | ✅ Current | |
| `concurrently` | ^10.0.5 | ✅ Current | Dev only |
| `@dietrichgebert/ponytail` | ^4.9.0 | ℹ️ Internal | Ponytail skill tooling |

### Server (`server/package.json`)

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| `express` | ^4.21.2 | ⚠️ Outdated major | Express 5 is stable; v4 still maintained but missing perf improvements |
| `pg` | ^8.16.3 | ✅ Current | |
| `@supabase/supabase-js` | ^2.117.2 | ✅ Current | |
| `cors` | ^2.8.5 | ✅ Current | |
| `dotenv` | ^17.2.3 | ✅ Current | |
| `express-rate-limit` | ^8.7.1 | ✅ Current | |
| `multer` | ^2.0.2 | ✅ Current | |

### Missing Dependencies (Recommended)

| Package | Purpose | Priority |
|---------|---------|----------|
| `helmet` | Security headers (X-Frame-Options, CSP, etc.) | **High** |
| `compression` | Gzip/brotli response compression | **High** |
| `zod` | Shared request validation schema | Medium |
| `pino` / `pino-http` | Structured logging | Medium |
| `morgan` (or pino-http) | HTTP request logging | Low |

---

## Detailed Findings

### 🔴 Critical

#### C1. No Rate Limiting on General API Routes
**File:** `server/src/middleware/rateLimit.js:1-36`, `server/src/index.js:25-27`  
**Finding:** Rate limiting is only applied to `/api/auth` (100 req/15min) and upload endpoints (50 req/15min). All other routes — jobs, applications, profiles, admin, reports, AI — have no throttling.  
**Impact:** Brute-force attacks on any endpoint, enumeration of user data, resource exhaustion.  
**Fix:** Apply a general API limiter (e.g., 300 req/15min per IP/user) to all `/api` routes. Keep stricter limits on auth and uploads.  
**Effort:** S (add one middleware line in `index.js`)

#### C2. Unbounded Queries on Admin Endpoints
**Files:** `server/src/routes/admin.js:39-56` (users), `169-174` (companies), `176-183` (jobs), `185-199` (applications), `223-229` (accreditations), `server/src/routes/reports.js:19-82` (reports)  
**Finding:** All admin list endpoints return full tables with no pagination. `GET /admin/users` scans all three role tables and returns every row. `GET /admin/applications` returns all applications with seeker/job embeds.  
**Impact:** At 1,000+ users with 10,000+ applications, these endpoints will return multi-megabyte JSON payloads, cause high memory usage, and potentially crash the Node.js process.  
**Fix:** Add `page`/`pageSize` query params with `LIMIT/OFFSET` SQL. Return `{ data, total, page, pageSize }` shape.  
**Effort:** M (per-endpoint changes + frontend updates)

#### C3. No Security Headers
**File:** `server/src/index.js:17-24`  
**Finding:** No `helmet` middleware. API responses lack `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, and other security headers.  
**Impact:** Clickjacking, MIME-sniffing, and other browser-based attacks.  
**Fix:** Add `helmet` middleware with sensible defaults.  
**Effort:** S

---

### 🟠 High

#### H1. No Compression Middleware
**File:** `server/src/index.js:17-24`  
**Finding:** No `compression` middleware. JSON responses for job lists, admin dashboards, and reports are uncompressed.  
**Impact:** Slower page loads, higher bandwidth costs. A 100-job list with employer embeds can be 50KB+ uncompressed.  
**Fix:** Add `compression` middleware before routes.  
**Effort:** S

#### H2. Heavy Frontend Libraries Not Lazy-Loaded
**Files:** `package.json:20-21` (mammoth, pdfjs-dist)  
**Finding:** `mammoth` (~2MB) and `pdfjs-dist` (~1MB+) are in root `dependencies`. They are only needed on the job-seeker profile page for resume parsing/rendering, but Vite's default bundling may include them in the main chunk or a shared chunk.  
**Impact:** Larger initial bundle, slower time-to-interactive for public-site visitors who never use resume features.  
**Fix:** Use dynamic `import()` for these libraries only on the pages that need them (Profile, JobDetail).  
**Effort:** M

#### H3. Missing Database Indexes
**File:** `db/schema.sql`  
**Finding:** 
- `job_applications(applied_at)` — used in `ORDER BY a.applied_at desc` in multiple queries (applications.js:71, admin.js:197, reports.js:25)
- `job_vacancies(deadline)` — used in `WHERE deadline < current_date` in admin stats (admin.js:25)
- `notifications(created_at)` — used in `ORDER BY created_at desc` (admin.js:448, notifications.js) — though there is a composite index on `(user_id, created_at)`, the `user_id` equality means it can't be used for cross-user ordering

**Impact:** Sequential scans on large tables, slow admin dashboard loads.  
**Fix:** Add indexes: `create index job_applications_applied_idx on job_applications(applied_at desc)`, `create index job_vacancies_deadline_idx on job_vacancies(deadline)`, `create index notifications_created_idx on notifications(created_at desc)`.  
**Effort:** S

#### H4. No Request Validation Library
**Files:** All route files  
**Finding:** Validation is hand-rolled and inconsistent. `auth/provision` validates thoroughly (role, employment_status, education shape). `jobs` POST only checks `title` presence. `applications` POST only checks `job_id` presence. No schema validation for PATCH bodies.  
**Impact:** Invalid data can reach the database, causing 500 errors or data integrity issues. Inconsistent validation makes the API harder to consume.  
**Fix:** Add `zod` schemas for request bodies. Apply consistently across routes.  
**effort:** M (per-route schema definitions)

#### H5. No Structured Logging or Observability
**File:** `server/src/index.js:41-47`  
**Finding:** Only `console.error` for unhandled errors. No request logging, no structured logs, no metrics, no tracing. The error handler intentionally does not log the error object (good for security), but there's no alternative diagnostic path.  
**Impact:** Production issues are difficult to debug. No visibility into API usage patterns, error rates, or performance bottlenecks.  
**Fix:** Add `pino-http` for request logging. Add structured error logging with request context (method, path, user id, correlation id).  
**Effort:** M

#### H6. Express 4 Instead of Express 5
**File:** `server/src/package.json:14`  
**Finding:** Express 4.21.2 is used. Express 5 is stable and offers better async error handling (rejected promises in handlers are automatically forwarded to error middleware), improved performance, and security fixes.  
**Impact:** Missing performance improvements and security patches. The `ah()` wrapper is a workaround for Express 4's lack of async error handling.  
**Fix:** Migrate to Express 5. The `ah()` wrapper becomes unnecessary.  
**Effort:** M (test suite needed to verify no regressions)

---

### 🟡 Medium

#### M1. Inconsistent Pagination on Job Endpoints
**Files:** `server/src/routes/jobs.js:44-94` (paginated), `104-118` (not paginated)  
**Finding:** `GET /jobs` has full pagination (`page`, `pageSize`, `total`). But `GET /employers/:employerId/jobs` returns all jobs for a company with no pagination.  
**Impact:** Employers with many job posts will have slow loads.  
**Fix:** Add pagination to employer jobs endpoint.  
**Effort:** S

#### M2. N+1 Query Pattern in Admin Users Endpoint
**File:** `server/src/routes/admin.js:39-56`  
**Finding:** `GET /admin/users` loops over 3 tables and runs a separate query for each. While not a classic N+1 (it's always 3 queries), it could be a single `UNION ALL` query.  
**Impact:** Minor — 3 queries is acceptable. But the `ORDER BY created_at DESC` is done in JS, not SQL, which means all rows are fetched before sorting.  
**Fix:** Use a single `UNION ALL` query with `ORDER BY created_at DESC LIMIT/OFFSET`.  
**Effort:** S

#### M3. No Soft Delete for Most Entities
**File:** `db/schema.sql`, `server/src/routes/jobs.js:329-336`  
**Finding:** Jobs are hard-deleted (ADR-013). Applications are hard-deleted by the retention purge. No `deleted_at` column on any table.  
**Impact:** Accidental deletes are unrecoverable. No audit trail of what was deleted (beyond the audit log entry).  
**Fix:** Consider adding `deleted_at` to critical entities (jobs, users) with a `WHERE deleted_at IS NULL` filter. Or document that hard delete is intentional.  
**Effort:** L (schema change + query updates)

#### M4. No CSRF Protection
**File:** `server/src/index.js`  
**Finding:** No CSRF middleware. The API uses `Authorization: Bearer` tokens, which mitigates CSRF for state-changing operations (browsers don't auto-send custom headers). However, if any endpoint relies on cookie-based auth, it would be vulnerable.  
**Impact:** Low — Bearer token auth is inherently CSRF-resistant.  
**Fix:** None needed if Bearer tokens remain the only auth mechanism. Document this decision.  
**Effort:** S (documentation only)

#### M5. No Connection Pool Configuration
**File:** `server/src/db.js:7`  
**Finding:** `new pg.Pool({ connectionString: process.env.DATABASE_URL })` uses defaults (max: 10 connections). No `idleTimeoutMillis`, `connectionTimeoutMillis`, or `maxLifetime` configuration.  
**Impact:** At 1,000 concurrent users, 10 connections may be insufficient. Idle connections may leak.  
**Fix:** Tune pool size based on expected concurrency. Add `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`.  
**Effort:** S

#### M6. No Health Check Deep Probe
**File:** `server/src/index.js:29-36`  
**Finding:** `/api/health` only checks `select 1` on the database. Does not check Supabase auth service health, disk space for uploads, or external AI service.  
**Impact:** If Supabase auth is down, the health check still returns `ok: true`, but no user can log in.  
**Fix:** Add optional deep health checks (Supabase ping, disk space) with a `?deep=true` query param.  
**Effort:** S

#### M7. Frontend Auth State Not Persisted
**File:** `src/shared/lib/supabase.js:11`  
**Finding:** `persistSession: false` means the session is not stored in localStorage. Every page refresh requires a new Supabase session check. This is a security-conscious choice but impacts UX (flash of loading screen on every refresh).  
**Impact:** UX — users see a loading spinner on every page navigation.  
**Fix:** This is a deliberate trade-off. Consider `persistSession: true` with `autoRefreshToken: true` for better UX, or keep as-is for security. Document the decision.  
**Effort:** S (one-line change, but security review needed)

#### M8. No Retry Logic for Transient Failures
**File:** `src/shared/lib/api.js:87-108`  
**Finding:** The `request()` function has no retry logic. A single network hiccup causes an error. The `settleAuth` function retries once on 401 (after token refresh), but not on 5xx or network errors.  
**Impact:** Poor UX on flaky networks.  
**Fix:** Add 1-2 retries with exponential backoff for 5xx and network errors.  
**Effort:** M

---

### 🟢 Low

#### L1. No API Versioning
**File:** `server/src/index.js:37`  
**Finding:** All routes are under `/api` without a version prefix. The contract mentions "Express API v1" but the routes are not versioned.  
**Impact:** Breaking changes in the future will require coordinated frontend/backend deploys.  
**Fix:** Add `/api/v1` prefix now, or document that versioning will be introduced when needed.  
**effort:** S

#### L2. No CORS Preflight Caching
**File:** `server/src/index.js:23`  
**Finding:** CORS middleware doesn't set `maxAge` for preflight responses.  
**Impact:** Extra `OPTIONS` requests on every cross-origin API call.  
**Fix:** Add `maxAge: 86400` to CORS options.  
**Effort:** S

#### L3. No Request ID / Correlation ID
**File:** `server/src/index.js`  
**Finding:** No request ID is generated or propagated.  
**Impact:** Difficult to trace requests across logs.  
**Fix:** Add middleware that generates `X-Request-ID` if not present.  
**Effort:** S

#### L4. No Database Migration Framework
**File:** `db/schema.sql`  
**Finding:** Schema is managed via raw SQL files. No migration framework (like node-pg-migrate, knex, or drizzle-kit).  
**Impact:** Manual schema changes are error-prone. No rollback mechanism.  
**Fix:** Consider adding a lightweight migration runner, or document that `schema.sql` is the source of truth and migrations are applied manually.  
**Effort:** M

#### L5. No Test Coverage for Backend
**File:** `server/package.json`  
**Finding:** No test framework in server dependencies. No test files in `server/src/`. The frontend has extensive Vitest tests, but the backend has none.  
**Impact:** Refactoring is risky. Bugs in auth, validation, or SQL queries go undetected.  
**Fix:** Add Vitest + supertest for integration tests. Start with auth and critical paths.  
**Effort:** L

#### L6. No Docker / Containerization
**File:** Project root  
**Finding:** No `Dockerfile` or `docker-compose.yml`.  
**Impact:** Deployment is manual. Environment inconsistencies between dev and prod.  
**Fix:** Add a simple `Dockerfile` for the API and a `docker-compose.yml` for local dev (API + Postgres).  
**Effort:** M

#### L7. No CI/CD Configuration
**File:** Project root  
**Finding:** No `.github/workflows/` or equivalent.  
**Impact:** No automated testing or deployment.  
**Fix:** Add GitHub Actions for lint + test on PR.  
**Effort:** S

---

## Scalability Assessment for 1,000+ Concurrent Users

### Current Capacity Estimate

| Component | Current Limit | Bottleneck |
|-----------|--------------|------------|
| Node.js event loop | ~1,000 concurrent connections | Single-threaded; CPU-bound tasks (SQL parsing, JSON serialization) block |
| PostgreSQL pool | 10 connections | Default `pg.Pool` max; will queue requests under load |
| Rate limiting | In-memory (single instance) | Won't work across multiple instances; memory leak risk if not configured |
| Static assets | Vite dev server or manual | No CDN, no caching headers |
| File uploads | Disk I/O | No streaming; files written to local disk |

### Scaling Path

**Phase 1: Vertical (current architecture)**
- Increase `pg.Pool` max to 20-30
- Add `compression` middleware (reduces bandwidth ~70%)
- Add pagination to admin endpoints (reduces memory pressure)
- Add `helmet` for security headers
- **Estimated capacity: ~500 concurrent users**

**Phase 2: Horizontal preparation**
- Move rate limiting to Redis store
- Add a CDN (Cloudflare) for static assets
- Add a read replica for PostgreSQL (read-heavy endpoints: jobs list, reports)
- **Estimated capacity: ~2,000 concurrent users**

**Phase 3: Horizontal scaling**
- Run multiple API instances behind a load balancer
- Use Redis for session storage (if sessions are ever persisted)
- Use a message queue (Bull/Redis) for notification fan-out
- **Estimated capacity: ~10,000 concurrent users**

---

## Recommended Fix Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| P0 | C1: General API rate limiting | S | Security |
| P0 | C2: Admin endpoint pagination | M | Stability |
| P0 | C3: Security headers (helmet) | S | Security |
| P1 | H1: Compression middleware | S | Performance |
| P1 | H3: Missing DB indexes | S | Performance |
| P1 | H5: Structured logging | M | Observability |
| P2 | H2: Lazy-load heavy libs | M | Bundle size |
| P2 | H4: Request validation library | M | Reliability |
| P2 | H6: Express 5 migration | M | Performance |
| P3 | M1-M8: Medium findings | S-M | Various |
| P4 | L1-L7: Low findings | S-L | Future-proofing |

---

## Architecture Strengths

1. **Clean separation of concerns** — Routes, middleware, utilities, and DB access are well-organized.
2. **Parameterized SQL throughout** — No string concatenation in queries; SQL injection surface is minimal.
3. **Consistent error contract** — `{ error: { code, message } }` across all routes.
4. **Role-based access control** — Clear guard matrix (seeker ⇄ own, employer ⇄ own company, admin ⇄ all).
5. **Database triggers for denormalized fields** — `sync_employer_accreditation_status` and `record_accepted_employment` keep derived data in sync without application-level coordination.
6. **Frontend code splitting** — Every page is lazy-loaded; public site doesn't download admin/employer bundles.
7. **Auth state management** — Clean context-based approach with proper loading states and role-based routing.
8. **Error boundary** — Root-level ErrorBoundary prevents full app crashes.
9. **Audit logging** — All data mutations are audited with actor, action, and entity.
10. **Retention policy** — Automated purge of stale applications with proper retention of employment records.

---

## Conclusion

The JobLinked codebase is well-architected for its current scale. The ADR-020 architecture is sound, the database schema is thoughtfully designed, and the frontend has good patterns for code splitting and auth state management. The most critical gaps are **security hardening** (rate limiting, headers) and **pagination** (admin endpoints), which should be addressed before the user base grows beyond a few hundred. The recommended fixes are mostly small-to-medium effort and can be implemented incrementally without architectural changes.

---

*End of Phase 1 Audit*
