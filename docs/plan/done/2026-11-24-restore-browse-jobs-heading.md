# Plan: Restore Browse Jobs page heading

## Brief
- What: Re-add a page-level heading to the job-seeker Browse Jobs page so the
  accessibility landmark (and the 7 failing unit tests in
  `Jobs.a11y.test.jsx` / `Jobs.loading.test.jsx`) pass again.
- Why: The 1:1 rebuild of Browse Jobs (`27ab9bb`) dropped the `PageHeading`
  that the previous version rendered; the a11y tests still assert a heading
  named "Browse Jobs".
- How: In `src/features/job-seeker/OpportunityList.jsx`, wrap `JobsBrowser` with
  a `PageHeading` (from `@/shared/components/design`) when `saved === false`,
  title "Browse Jobs". For `saved === true`, title "Saved jobs".
  Keep the rest of JobsBrowser unchanged. Do not touch the shared JobsBrowser
  (it is reused by the public bulletin and saved variants).
- Done when: `npm test` reports 0 failures (client 1820/1820, server 922/922)
  and `npm run lint` passes.
- Out of scope: visual redesign, public bulletin heading, e2e smoke (skipped
  to protect production DB).
- Assumptions: PageHeading component exists and renders an `<h1>`. Confirmed
  in src/shared/components/design.jsx.
