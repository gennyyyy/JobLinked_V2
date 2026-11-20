# PESO Revision Checklist — Verification Report

Date: 2026-11-20. Baseline: `main` @ bb1b509 plus in-progress uncommitted changes (Register/TermsModal). Test run: `npm test` → 1441 passed / 5 failed / 6 skipped (229 files). The 5 failures are all in `EmployerRegister.test.jsx` and are caused by the in-progress uncommitted changes (verified: clean stash → 9/9 pass); not a regression from this checklist.

## Implementation result (2026-11-20, evening)

All code items below were implemented under
`docs/plan/2026-11-20-peso-revision-fixes-plan.md` (now in `docs/plan/done/`).
Commits: `aa9ec1f` (migration 016 + vocabularies), `0bdf793` (public vocabulary
endpoint), `d484bba` (job field/skills contract), `862add3` (seeker field +
canonical skills), `5a887d4` (matching engine), `545d17c` (shared pickers),
`04e519e` (employer form), `23336d4` (seeker profile/registration), `f0154e6`
(terminology), `4358aee` (display separation), `c0b5192` (Browse layout),
`bbb8a71` (homepage pillars).

Verification: server `98 passed / 1 skipped` files, `793` tests passed; client
`1520` passed with 13 failures that are not regressions — 5 pre-existing
`EmployerRegister.test.jsx` failures caused by another agent's uncommitted
TermsModal change, and 8 load-induced 5 s timeouts that pass in isolation
(`--testTimeout=20000`). Lint clean, build passes. `npm run syscheck` completed
the public route sweep; its 16 flags are all third-party Cloudflare Turnstile
noise (`brunhild.challenges.cloudflare.com` DNS failures and its own `%c`
console lines), unrelated to this work.

Statuses below are updated to reflect the implementation.

## 1. Employer dashboard: post a job, see applicants per job, update status, edit and close postings

Status: PASS (code + tests)

Evidence:
- Post a job: `JobPosts.jsx` handleOpenCreate/handleSaveJob (createJob/updateJob), accreditation gate.
- Applicants per job: `JobPosts.jsx` renders `post.applicant_count` per row; Dashboard.jsx renders `{job.applicants}` per vacancy and total candidates.
- Update status: `Applicants.jsx` CandidateDetail → updateApplicationStatus with Applied/Under Review/Interview/Accepted/Rejected/Placed/Terminated.
- Edit: handleOpenEdit pre-fills form; Close/reopen: handleToggleClose (published↔closed).
- Tests: `src/features/employer` 20 files / 71 tests passed (JobPosts, Applicants, Dashboard).

## 2. Describe matching as rule-based or AI; make Find Jobs banner, paper, defense agree

Status: RESOLVED IN CODE — canonical wording is “skills-based matching” with “AI-assisted ranking” as the optional assist (`src/shared/content/matching.js`); the paper/defense wording remains an external action (Appendix of the plan).

Evidence:
- Code uses AI: `JobsBrowser.jsx` matchJobs + "AI matching is unavailable right now…" + matchModeLabel "AI ranking active".
- Banner contradicts: `JobsBrowser.jsx` Notice "Skills overlap… It is not AI, a hiring score, or a guarantee."
- Paper/defense are outside this repo (academic deliverables) — cannot verify from code.
Gap: pick one term and apply it everywhere (banner, code strings, paper, defense). Currently both "AI" and "not AI" appear.

## 3. One controlled tag list (field + skills) shared by employer postings and seeker profiles

Status: RESOLVED — one controlled vocabulary (`reference_data` categories `job_field` and `skill`), structured `field`/`skills` on both sides, shared pickers, and a loss-free backfill of every existing seeker skill.

Evidence:
- Employer postings use `JOB_TAGS` (7 posting attributes: Urgent Hiring, Fresh Grad Friendly, …) in `constants.js` + `JobPostFormDialog.jsx`.
- Seeker skills are free-text comma-separated (`Profile.jsx` splitList, `TagField`); no controlled list.
- No shared "field" tag list exists anywhere.
Gap: create one controlled list and use it in both posting form and seeker profile.

## 4. Show field and skill tags separately from On-site / Hybrid / Remote

Status: RESOLVED — Field, Skills, Highlights, and Work arrangement render as separate labelled groups on cards and both detail pages; the Browse filter is “Job field”.

Evidence:
- Work arrangement already separate select: `JobPostFormDialog.jsx` (On-site / Remote / Work from home / Hybrid); schema `work_arrangement` enum. Good.
- But "field and skill tags" are not a distinct, controlled concept yet (see item 3); JOB_TAGS are posting attributes, seeker skills free-text.
Gap: once item 3 lands, render field/skill tags in their own group, distinct from the work-arrangement control.

## 5. Make matching, PESO accreditation and tracking the center of homepage and Browse Jobs (not standard filters)

Status: RESOLVED — Browse Jobs leads with the matching panel and hides standard filters behind a collapsed “Refine results” disclosure; the homepage leads with a skills-matching CTA and three pillars (matching, PESO accreditation, tracking).

Evidence:
- Homepage `HomeHero.jsx`: keyword + barangay search + popular searches; assurances mention verified employers / PESO; no matching/accreditation/tracking center.
- Browse Jobs `JobsBrowser.jsx`: has matching (PreferenceMatching) but also a prominent standard filter sidebar (barangay, category, type, salary, experience) — 5 filters.
Gap: de-emphasize standard filters; surface matching, PESO accreditation status, and tracking (employment tracking nav exists for seekers/employers) as the center.

## 6. Cite the PESO needs analysis as the response to the required revision

Status: EXTERNAL / NOT VERIFIABLE IN CODE

Evidence: academic paper/defense artifact, not in repo. Flag for the paper and defense deck.

## Summary

- PASS: 1
- RESOLVED IN CODE: 2, 3, 4, 5
- EXTERNAL (human): 2 (paper/defense wording), 6 (PESO needs analysis citation)
- Regression check: no new failures attributable to this work (see Implementation result).

Remaining actions (external, no code): adopt the canonical matching sentences in the paper/defense (item 2) and cite the PESO needs analysis (item 6). Every code item is implemented and verified above.
