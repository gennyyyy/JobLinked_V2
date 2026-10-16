-- =============================================================================
-- 009_ordering_indexes.sql — H3 (phase-1 audit): the two verified orderings
-- that full-scan + sort today. Apply: psql -d joblinked -f db/migrations/009_ordering_indexes.sql
-- (db/schema.sql index block is updated to match.)
-- Safe to re-run: every statement is IF NOT EXISTS.
--
-- Each index below is backed by a REAL query in server/src/routes/*.js
-- (verified line-by-line, not speculative):
--   1. job_applications(applied_at desc) — `order by a.applied_at desc` with
--      no seeker/job filter: admin.js GET /admin/applications (line 226),
--      admin.js GET /admin/referrals (line 248),
--      reports.js applicants report (line 25). Without it these are the only
--      orderings that must sort the whole (unbounded, C2) result set; an index
--      scan returns rows pre-sorted and the PK joins preserve that order.
--      The filtered siblings (/applications/mine seeker_id = $1,
--      /applications/job/:jobId job_id = $1, company/:companyId) keep using
--      job_applications_seeker_idx / _job_idx + a small sort — a bare
--      applied_at index cannot serve them better at 1,000 users.
--   2. job_vacancies(deadline) — `deadline < current_date` in the admin stats
--      endpoint (admin.js:25, expiredJobs counter, runs on EVERY dashboard
--      load). The applications INSERT deadline guard (applications.js:66-69)
--      does NOT need it: that subquery filters `id = $1` (PK lookup).
--   3. NOT added: notifications(created_at desc). The audit's citation is
--      stale — there is no notifications.js route and no cross-user ordering
--      anywhere. The only ORDER BY created_at is /notifications/mine
--      (admin.js:481) which is `user_id = $1 ... order by created_at desc
--      limit 50` — already served by notifications_user_created_idx
--      (user_id, created_at desc). Composite leading equality cannot serve
--      cross-user ordering, but no query asks for it.
--
-- Lock/time: plain CREATE INDEX (not CONCURRENTLY) so it runs in one
-- transaction; sub-second on current size (largest table: notifications ~23 rows).
-- On a large existing job_applications table prefer CREATE INDEX CONCURRENTLY
-- (run each statement outside a transaction).
-- =============================================================================
BEGIN;

CREATE INDEX IF NOT EXISTS job_applications_applied_idx ON public.job_applications(applied_at DESC);

CREATE INDEX IF NOT EXISTS job_vacancies_deadline_idx ON public.job_vacancies(deadline);

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP INDEX IF EXISTS public.job_vacancies_deadline_idx;
-- DROP INDEX IF EXISTS public.job_applications_applied_idx;
