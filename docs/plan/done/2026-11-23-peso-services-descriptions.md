# PESO Services: describe each of the four services

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** the PESO Services page describes each of the four services with three labelled
  parts: **What it is**, **Who it’s for**, **How to get it**.
- **How:** extend `PESO_SERVICES` with `what` / `who` / `how` fields (keep the existing
  `description` for the landing page), render them as a definition list per service, and
  add a closing contact line using the existing `PesoOfficeInfo` component.
- **Done when:** all four services show the three labelled descriptions, the landing page
  is unchanged, and tests/lint pass.
- **Out of scope:** other public pages, server changes, the landing-page blurbs.

## Copy (exact)

1. **Job matching & placement**
   - What: PESO matches registered job seekers with vacancies from accredited local
     employers and refers suitable applicants for interview.
   - Who: Job seekers looking for local employment, including fresh graduates, first-time
     applicants, and workers returning to the workforce.
   - How: Create a JobLinked account, complete your profile, and apply to posted vacancies.
     You can also visit the PESO office for referral assistance.
2. **Community job fairs**
   - What: PESO brings accredited employers together in one venue so applicants can learn
     about openings, submit resumes, and interview without travelling to each company.
   - Who: Job seekers who want to meet employers in person, and employers with current
     hiring needs.
   - How: Watch for job-fair announcements on JobLinked and official PESO channels,
     prepare copies of your resume, and attend on the scheduled date.
3. **Career guidance**
   - What: PESO provides career planning advice, resume and interview coaching, and
     guidance on training or employment paths suited to your goals.
   - Who: Students, fresh graduates, job seekers considering a change, and workers
     planning their next career step.
   - How: Ask for a career guidance session at the PESO office, or call or email to arrange
     an appointment. Bring a draft resume and your questions.
4. **Skills & livelihood training**
   - What: PESO shares announcements and referrals for skills training and livelihood
     programs run with TESDA and other partner agencies.
   - Who: Unemployed and underemployed residents, displaced workers, youth, and anyone who
     wants to learn a trade or start a small livelihood.
   - How: Check the training schedules announced by PESO, then register at the office with
     a valid ID. Slots, requirements, and schedules depend on the partner provider.

Closing note: keep “Program information only. Confirm actual availability with official
channels.” and add “Questions about a service? Contact the Santa Maria PESO office:”
followed by `<PesoOfficeInfo className="text-sm" />`.

## Changes

- `src/shared/constants.js` — add `what`, `who`, `how` to each `PESO_SERVICES` entry.
- `src/features/public-site/PesoServices.jsx` — map `{ title, what, who, how }`; render a
  `<dl>` with three `<div>` groups; `dt` classes
  `text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`, `dd`
  `mt-1 text-sm leading-7 text-muted-foreground`. Add the contact section at the bottom.
- Landing page (`CommunitySections.jsx`) stays untouched (still uses `description`).

## Tests

- `src/features/public-site/__tests__/PesoServices.test.jsx`: assert the four titles, that
  “What it is / Who it’s for / How to get it” each appear four times, and one sample
  who/how line (e.g. TESDA training).
- Keep the existing heading test.

## Acceptance

`npx vitest run src/features/public-site/__tests__/PesoServices.test.jsx`, then `npm test`
and `npm run lint`, all passing.
