# Security Delta Audit Plan — 2026-11-13

**Project:** JobLinked (PESO Santa Maria) — React/Vite SPA + Express API + PostgreSQL (Supabase auth only)
**Owner:** Lead Architect (sign-off required before any execution agent starts)
**Mode:** Read-only audit. No code or schema changes by auditors; fixes become separate tasks after sign-off.
**Status:** Executed 2026-11-13 — all phases complete. Reports: `docs/arch/audit/2026-11-13-delta-security-audit.md`, `2026-11-13-admin-guard-matrix.md`, `2026-11-13-phase4-probes.md`. Gate: **FAIL** — G-01 and F-15 (both High) blocking; fixes proceed via the report's §12 fix-task handoff as separate tasks.

## Why a delta, not a full re-audit

The codebase already holds a complete audit suite at `docs/arch/audit/` (2026-10-15: six phases,
verdict "no Critical/High findings") and an executed security plan at
`docs/plan/done/2026-11-04-04-security-compliance-plan.md`. Re-auditing everything would re-read
files whose verdicts are a month old, not stale — many were re-verified while closing the 2026-11-04
plan. What changed since 2026-11-04 is a real new attack surface:

- Custom-role permission **enforcement** (ADR-042, `server/src/middleware/permissions.js`) — supersedes
  the "document, don't enforce" posture of the 2026-11-04 plan (ADR-036 kept roles descriptive for UI).
- Admin router decomposition (ADR-026): `admin.js` split into `admin-users.js`, `admin-jobs.js`,
  `admin-reference.js`, `admin-shared.js`. The 2026-10-15 audit explicitly observed `admin.js` mid-edit
  and asked for re-verification — that debt is still open.
- AI surface: `routes/ai.js`, `routes/aiMatch.js`, `src/ai/briefs.js`, `aiProvider.js`
  (OpenRouter `OPENROUTER_API_KEY`), resume autofill (ADR-045).
- Captcha: Turnstile on auth (ADR-041).
- Remote Postgres cutover (ADR-044) — the API now talks to a database over the network in production.
- Single-node production deployment (ADR-037) with monitoring/metrics (`ADR-043`, `routes/metrics.js`).
- One-resume-per-account (ADR-049) — landed 2026-11-13, same day as this plan.
- **External scan of production** (Web Security Scanner, 2026-11-12 19:40 UTC) against
  `https://www.joblinked.site/` — the Vercel-served SPA root: five security headers reported missing
  (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and
  `access-control-allow-origin: *` on the frontend host. The scan covered the frontend origin only,
  not the API. Disposition in Phase 5; root cause already identified: `vercel.json` has no `headers`
  block, and helmet protects only `/api/*` on the separate API server (ADR-037 single node, VPS
  cutover 2026-11-12).

## Scope

**In:** every `server/src` route/middleware/service file, `db/schema.sql` (read-only), frontend
`src/**` for XSS-sink and secret-leak checks, both lockfiles, git history for secrets, config/env surface.

**Out (accepted ceilings — do NOT re-flag, list stays pinned in the compliance plan):**
- 60 s JWT revocation window (ADR-028).
- In-memory rate-limit store — valid while single node (ADR-037).
- Four unbounded reads by design (ADR-029).
- Audit-log date filter assumes UTC+8 host.
- Helmet's default CSP as shipped (reviewed 2026-11-04; pinned by tests).

**Conduct rules (apply to every phase):**
- Live probes run only against local instances (`npm run dev`). Never against the production node
  (ADR-037) or the remote production database (ADR-044). Exception: read-only GETs against the public
  production site root (`https://www.joblinked.site/`) are permitted for header verification — that is
  exactly what the external scanner does. Everything else stays local.
- `server/scripts/verify-live.mjs` is the sanctioned local live harness for Phase 4 — it is
  hard-guarded to `joblinked_bench` on localhost and must never be pointed at production (its own
  header says so).
- `db/schema.sql` is never modified (repo rule: architect approval required).
- Findings files must never contain secret values, tokens, or the production `DATABASE_URL`.
- Every claim of "verified secure" or "vulnerable" cites `file:line` and, for live probes, the
  exact request/response evidence.

## Findings format and severity (reuse, don't invent)

Follow `docs/arch/audit/phase5-security-audit.md`: one table row per finding —
`ID | Severity | OWASP | file:line | Issue | Recommended fix` — plus a "Verified secure (do not
regress)" section. Severity: **Critical** = RCE, auth bypass, mass PII exposure; **High** = data
exposure, privilege escalation; **Medium** = limited scope or needs conditions; **Low** = hardening;
**Info** = observation. One new row in the format: a `Disposition` note when a finding is an accepted
ceiling (link the ADR) instead of a fix.

## Phases

### Phase 0 — Regression of the 2026-10-15 verdicts

**Agent:** security-auditor
**Task:** for each prior finding, record its current disposition (fixed / open / accepted ceiling), and
spot-check the "verified secure" list for regressions. Pre-verified during planning (2026-11-13),
needs only confirmation rows:

| Prior ID | Expected status (per planning greps) |
|---|---|
| F-01 rate-limiter IP keying | **Fixed** — `TRUST_PROXY` defaults to 0, fail-safe (`server/src/app.js:45-46`); confirm limiter tests pin it |
| F-02 hardcoded `trust proxy` | **Fixed** — same lines, env-driven |
| F-03 client-forgeable `/api/audit` actions | **Unknown** — no allowlist/namespace found in `routes/auth.js` during planning; classify |
| F-04 free-text `doc_type` | **Likely open** — `routes/profiles.js:237-238` still validates only presence |
| F-05 no numeric/date validation on PATCH | **Fixed** — `routes/jobs.js:284,291,352,362` |
| F-06 no magic-byte check on uploads | **Fixed** — `server/src/upload.js:43-49` (`matchesSignature`), pinned by `upload.signatures.test.js` |
| F-07 helmet defaults | **Present** — `app.js:56` |

Then re-confirm the three headline invariants from phase5 §"Verified secure": (1) every route has
`auth`/`tokenAuth`/`optionalAuth` and every `requireRole` rides behind `auth`; (2) all SQL is
parameterized with column/identifier allowlists; (3) no server secret is referenced under `src/**`.
**Exit:** disposition table complete; any regression to a "verified secure" item is a new finding.

### Phase 1 — New surface audit (shipped after 2026-11-04)

**Agents:** security-auditor (items 1–5, 8–10), api-security-audit (item 2 deep pass)

1. **Custom-role enforcement (ADR-042).** Verify `requirePermission` sits after
   `auth` + `requireRole('super-admin')` on every guarded route across the split admin routers;
   verify the bundle keys written to `reference_data` are super-admin-writable only and validated
   against a key allowlist; verify the fail-open branch (`customRoleId` unset → full access,
   `permissions.js:19`) is intentional break-glass and pinned by a test that production always
   resolves both fields; verify permission keys are never client-supplied.
2. **Admin router decomposition.** Re-run the full guard matrix (phase5 §Authorization) across
   `admin-users.js`, `admin-jobs.js`, `admin-reference.js`, `admin-shared.js` and what remains in
   `admin.js` — owner/tenant checks in every handler, `company_id` never from the body.
3. **AI endpoints.** `routes/ai.js` is already well-shaped (≤10 messages × ≤1000 chars, server-side
   brief selection via `Object.hasOwn`, `auth` + `aiLimiter`, 503 fail-closed). Verify the same
   bounds on `aiMatch.js`; verify **no PII leaves the system to OpenRouter** — help briefs are role
   docs, but check the autofill/matching pipelines never send resume or applicant content;
   verify model output is only rendered as JSX text on the frontend (no `innerHTML`/`eval`) and
   never feeds SQL, file paths, or shell commands (OWASP LLM05/LLM01).
4. **Turnstile captcha (ADR-041).** Server-side `siteverify` with the secret from env; empty/used/
   stale tokens rejected; fail-closed or explicitly fail-open-with-log on provider outage; captcha
   not skippable by direct API call to the endpoint it protects.
5. **Remote database (ADR-044).** `DATABASE_URL` requires TLS (`sslmode=verify-full` or equivalent
   in `db.js`); connection string never logged (error middleware logs message only — confirm).
6. **Metrics endpoint (ADR-043).** `METRICS_TOKEN` compare is constant-time and fails closed to 404 —
   confirmed in code; verify the token is not in the client bundle and never logged.
7. **Profile images (ADR-040).** Same signature/magic-byte and path-traversal treatment as resumes;
   bucket allowlist on serve; no unbounded image size.
8. **One resume per account (ADR-049, new today).** Ownership guard on replace/delete, orphan-file
   cleanup on failed writes, no race that leaves two "current" resumes.
9. **Token cache (ADR-028).** Cached keyed by token (or hash) not user-controlled id; nothing
   sensitive about a cached principal logged; the 60 s window is the accepted ceiling.
10. **Request logging/metrics middleware.** No query strings, bodies, or PII in `requestLog.js` /
    `metrics.js` payloads.

**Exit:** one verdict line per item; new findings registered.

### Phase 2 — Secrets and supply chain

**Agent:** security-auditor
**Tasks:**
- `git log --all --diff-filter=A` for any `.env*`; `git grep` for `SUPABASE_SERVICE_ROLE`,
  `DATABASE_URL`, `OPENROUTER_API_KEY`, `TURNSTILE_SECRET`, `METRICS_TOKEN` — expect hits only in
  `server/src`, `server/.env.example`, and docs. Confirm `.env.local` and `server/.env` are still
  gitignored (`git check-ignore`).
- `npm audit` against **both** committed lockfiles (`package-lock.json` and `server/package-lock.json`
  — separate workspaces, root SPA vs API). Triage by reachability; never `audit fix --force`.
- Diff `package.json` / `server/package.json` against 2026-11-04 state; review any new dependency
  (ownership, age, install scripts).

**Exit:** no secret in history or client code; audit findings triaged with a documented review date.

### Phase 3 — Compliance review of the shipped legal copy

**Agent:** security-auditor (one paragraph in the report)
The 2026-11-04 plan left `/privacy` and `/terms` blocked on stakeholder copy; since then real text
landed in `src/shared/content/legal.js` (Privacy Notice and Terms of Use, RA 10173 framing) and
`Legal.jsx` now renders it for both pages and the registration consent modal — the placeholder is
gone. The remaining work is a **review, not a build**: confirm the notice names what the system
actually collects (identity, contact, education, employment history, resumes), the stated purposes
(job matching, LGU/PESO reporting), retention that matches the real `runRetentionPurge` behavior,
and RA 10173 data-subject rights; confirm footer links, `/privacy`, `/terms`, and `TermsModal.jsx`
all read from `src/shared/content/legal.js` with no divergent copy. Any gap is a Low finding with
the missing sentence named, not a rewrite task.

### Phase 4 — Live probes (local only)

**Agent:** penetration-tester
Run against a local `npm run dev` stack using the existing supertest harness
(`server/src/__tests__/helpers/app.js`) where possible — the harness drives real middleware order.
Probes: authz matrix spot-checks as seeker/employer/super-admin/custom-role (expect 401/403/404 per
contract); rate-limit bucket rotation via client-set `X-Forwarded-For` with `TRUST_PROXY` unset
(expect socket-address keying); upload abuse (bad magic bytes, oversized, traversal filename);
captcha replay/omission; prototype-pollution keys (`__proto__`, `constructor`) against `/ai/help`
and JSON bodies. No destructive payloads; no prod targets (see Conduct rules).

**Exit:** each probe logged with request/response evidence or a test that pins it.

### Phase 5 — Frontend edge and external scanner cross-reference

**Agent:** security-auditor
**Input:** Web Security Scanner report for `https://www.joblinked.site/`, 2026-11-12 19:40 UTC
(frontend origin only; the API is a separate VPS origin and is covered by Phases 0–4).

Cross-reference each scanner finding to the repo layer that owns it, then disposition:

| Scanner finding | Owning layer | Disposition required |
|---|---|---|
| Missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | Vercel static host — `vercel.json` has only `rewrites`, no `headers` block; helmet covers `/api/*` only | **Finding (High, A05).** Draft the exact `vercel.json` `headers` block as a proposed patch inside the report: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` (or CSP `frame-ancestors 'self'`), `Referrer-Policy: strict-origin-when-cross-origin`, a minimal `Permissions-Policy`, and a CSP whose allowances are derived from the built `dist/index.html` and runtime origins (API origin from `VITE_API_URL`, Supabase URL, Turnstile `challenges.cloudflare.com`, plus whatever fonts/CDNs the build actually references). Do not guess allowances — list them from evidence. |
| `access-control-allow-origin: *` on the frontend host | Not in `vercel.json`, not from the API (its CORS fails closed — pinned by `server/src/__tests__/middleware-hardening.test.js:95-121`; prod must list `https://www.joblinked.site` per the 2026-11-12 cutover runbook) | Determine the source (likely Vercel's static-asset behavior). Assess: the origin serves only public static assets and holds no credentials (auth uses Bearer tokens to the API), so risk is Low — but document it as an accepted ceiling or override it via the same `headers` block, stating which and why. Do not "fix" the API's CORS here — wrong layer. |
| `strict-transport-security: max-age=63072000` present | Vercel-managed | Present — no action. Note as Low/optional whether `includeSubDomains` should be requested, with the standard caveat that it binds every subdomain including the API host. |
| `server: Vercel` value | Scanner noise | No action. |
| COOP / COEP / CORP listed as "upcoming" | API already sets CORP `cross-origin` for file streaming (`server/src/app.js:56`); frontend host has none | Optional Low hardening in the same `vercel.json` block; only if it does not break the SPA. |

**Verification after the fix lands (separate task, post-sign-off):** `curl -sI https://www.joblinked.site/`
(read-only, permitted per conduct rules) must show all five headers, and the operator re-runs the
external scanner to confirm the risk banner clears.

**Exit:** every scanner finding has a disposition row tied to a layer; the proposed `vercel.json`
patch is in the report; new findings numbered in the F-series.

### Phase 6 — Report and gate

**Agent:** security-auditor writes `docs/arch/audit/2026-11-13-delta-security-audit.md`;
**Lead Architect reviews and signs off.**
- Disposition table (Phase 0) + new findings (Phases 1–5) + updated accepted-ceiling list (new
  ceilings get an ADR or an in-code comment naming the ceiling and upgrade path — no silent shrugs).
- **Gate:** zero unmitigated Critical/High; every prior finding has a disposition; every new surface
  has a verdict. Gate failure = findings become fix tasks (planned separately, never fixed inline
  by the auditors).

## Execution order and handoff

1. Lead Architect sign-off on this plan (this document).
2. Phase 0 (security-auditor) — must finish first; its disposition table tells Phase 1 what is
   already known.
3. Phase 1 and Phase 2 in parallel after Phase 0; Phase 5 (scanner cross-reference) also runs in
   parallel — it is independent of the code-audit phases.
4. Phase 4 after Phase 1 (probes target what Phase 1 flagged).
5. Phase 6 synthesis; Lead Architect sign-off; then fix tasks if the gate fails — including the
   `vercel.json` headers fix task from Phase 5.

Agents are dispatched per phase from the team roster: `security-auditor`, `api-security-audit`,
`penetration-tester`. No implementation agent touches code during the audit.

**Skill mandate (Lead Architect, 2026-11-13):** every security agent loads the red-team skill set
before starting — `offensive-security`, `offensive-api-security`, `offensive-api-abuse`,
`offensive-advanced-redteam`, `offensive-jwt`, `offensive-reporting` (the relevant subset per phase).
Their methodology, attack-case checklists, and reporting structure are adopted as **review lenses
only**: the conduct rules above (read-only, local-only, no remote DB) remain binding and override any
active-testing technique in those skills. Phase 4 is where offensive technique is applied, and still
only against local instances.
