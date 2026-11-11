# ADR-047: Prohibited-fee filter for job posts

**Status:** Accepted (2026-11-11, Lead Architect). Supersedes the plan's provisional
`adr-045` label — 045 was already taken twice; this is the first free number.
**Plan:** `docs/plan/2026-11-11-prohibited-fee-filter.md`
**Related:** ADR-000 (direct publish, no approval flow), `job_status` enum, `notifyAdmins`.

## Context

PESO-accredited employers publish directly (ADR-000). A post that demands money from
applicants ("registration fee", "processing payment", "bayad muna") must not reach job
seekers, but a false positive must not silently destroy legitimate vocabulary either
("No fees are collected" is a legitimate sentence that still needs a human decision).
The enforcement point is the API, not the browser: the employer dialog hint is cosmetic.

## Decision

1. **Dual severity, server-side only.**
   - **Blocked** — unambiguous collection phrases. The write is rejected with
     `422 FEE_POLICY_BLOCKED`; nothing is inserted or updated.
   - **Held** — any other fee/payment/donation vocabulary. The write is allowed but cannot
     become `published`: the server writes `status='pending'`, one
     `job_prohibited_flags` row, a `job_status_history` row, and notifies PESO admins plus
     the employer. Seekers never see it (`published` is the only public visibility).
2. **The review lane is reused, not extended.** `pending` already exists in `job_status`;
   the admin `PATCH /admin/jobs/:id` + `POST /admin/jobs/:id/publish` paths are the
   approval surface. No enum change, no new admin queue.
3. **Super-admins are exempt from blocking but must close the loop.** An explicit admin
   publish/approve is the human decision: it allows the post and resolves every open flag
   `('approved', resolved_by, now())`. An admin content edit that leaves fee language intact
   keeps the post `pending` and the flag open; a clean edit resolves the flag `('cleared')`.
4. **One open flag per job.** A partial unique index on `(job_id) where resolved is null`
   makes duplicate-hold prevention a database invariant; re-publishing a held post updates
   nothing extra.
5. **Detection is a fixed, test-covered lexical list.** No AI/ML in v1. Normalization:
   lowercase, strip punctuation to spaces, collapse whitespace, re-join letter-spaced runs
   ("r e g i s t r a t i o n" → "registration"), then whole-token phrase match. Ceiling:
   deliberate misspellings and paraphrase escape the filter; grow the list as data, and
   add NLP only if measured evasion appears. Terms live in
   `server/src/services/jobFeeFilter.js` and are served read-only to employer/admin clients
   via `GET /jobs/fee-filter/terms`.
6. **Hard-block list (unambiguous demands):** registration fee, processing fee, processing
   payment, placement fee, recruitment fee.
7. **Hold list (review-worthy vocabulary):** fee, fees, payment, payments, deposit,
   donation(s), bayad, magsingil, singil, pabayad, magbayad, reg fee, application fee,
   training fee. This deliberately holds "no fees are collected" — the admin clears it.

## Consequences

- Seeker-visible surfaces are unchanged unless a post is clean: one extra scan per write.
- Employers get an inline warning from the same list (cosmetic) and a clear 422 or
  "submitted for PESO review" message.
- Admin JobPosts gains a fee-evidence strip (matched terms + source fields) on held rows;
  approval routes through the existing admin PATCH, which resolves the flag server-side.
- Every hold/clear writes `audit_logs`; the employer-facing copy stays plain and instructive.
- Rollback: code revert (filter module + route wires + UI) then `drop table
  public.job_prohibited_flags;` — nothing else references it. Held posts stay `pending`;
  re-enabling old behaviour requires an explicit `update job_vacancies set status='published'
  where status='pending'` decision (documented, not hidden).
