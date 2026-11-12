# Employer profile browsing — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Let any visitor open an employer's public profile and see that company's published job postings beneath it.

**Architecture:** Reuse the existing `employers` row. Add one public read endpoint returning a filtered projection, open the existing employer-jobs endpoint to anonymous callers (pinned to `published`), and add a public frontend page linked from job cards/detail. No schema change.

**Tech Stack:** Express + pg (server), React + Vite + Tailwind (client).

**Spec:** docs/arch/adr-048-public-employer-profile.md, docs/arch/rework/02-api-contract.md (Jobs + Employers sections)

## Global Constraints
- No DB schema changes (ADR-048); reuse `employers`.
- No new dependencies.
- Public responses exclude PII (rep name/email/phone, company_email, full street address).
- Only `status = 'active'` employers are publicly visible; unknown/inactive → 404, non-uuid → 400.
- Jobs list for non-owner is pinned to `published`.
- Keep API error shape `{ error: { code, message } }`.

## Review Focus
- Anonymous caller must not see draft/pending/closed jobs (status pinned server-side, not client).
- Employer profile must not leak PII or inactive/suspended employers.
- Frontend link must not break job card/detail layout (visual parity).
- Logo must render via existing `/employers/:id/logo` endpoint.

## Directory Structure Blueprint
- Modify: `server/src/routes/profiles.js` (add `GET /employers/:id` public projection)
- Modify: `server/src/routes/jobs.js` (make `/employers/:employerId/jobs` optionalAuth + public published-only)
- Modify: `src/shared/services/jobs.js` (`getEmployer` helper; reuse `listEmployerJobs`)
- Create: `src/features/public-site/PublicEmployerProfile.jsx`
- Modify: `src/App.jsx` (route + lazy loader)
- Modify: `src/shared/lib/routeLoaders.js` (loader entry)
- Modify: `src/features/public-site/PublicJobDetail.jsx` (link company name to profile)
- Modify: `src/shared/components/BrowseJobs.jsx`? optional — keep minimal; profile page renders its own list using `listEmployerJobs` + `JobCard`

## Tasks

### Task 1: Backend — public employer profile endpoint
**Files:** Modify `server/src/routes/profiles.js`
- Add `router.get('/employers/:id', ah(async ...))` (no auth) returning projection for active employers; 400 non-uuid, 404 otherwise.

### Task 2: Backend — open employer jobs endpoint to public
**Files:** Modify `server/src/routes/jobs.js` lines ~159-192
- Change `auth` to `optionalAuth`; allow anonymous; if not owner/super-admin, force published and ignore status param; keep 400/403 rules.

### Task 3: Frontend service helper
**Files:** Modify `src/shared/services/jobs.js`
- Add `getEmployer(id)` → `api.get('employers/${id}')`.

### Task 4: Frontend page
**Files:** Create `src/features/public-site/PublicEmployerProfile.jsx`
- Fetch employer + jobs; render profile card + job list (JobCard) + pager; loading/error states; link back to /jobs.

### Task 5: Routing + loader
**Files:** Modify `src/App.jsx`, `src/shared/lib/routeLoaders.js`
- Add `PublicEmployerProfile` lazy route `/employers/:employerId`.

### Task 6: Link from job detail/card
**Files:** Modify `src/features/public-site/PublicJobDetail.jsx`
- Make company name a Link to `/employers/${job.employers.id}` when id present.

### Task 7: Tests
**Files:** add focused tests mirroring existing patterns.
- Server: `profiles.employer-public.test.js` (or extend) for projection/404/400.
- Client: `PublicEmployerProfile.test.jsx` if time.

## Handoff
Backend agent: Tasks 1-2. Frontend agent: Tasks 3-6. Review agent: Task 7 + lint.