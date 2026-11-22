# Company logo on job postings

Status: approved 2026-11-23 — implement via `fullstack-developer`.

## Confirmed brief

- **What:** job postings display the employer's current company logo instead of
  always falling back to initials, and that image updates when the logo is
  replaced/removed (cache-busted by the logo version).
- **Surfaces:** the shared job card (public job board, job seeker job list,
  public employer profile's vacancy list) and both job detail pages (public and
  job seeker).
- **How:** include `profile_images.updated_at as logo_updated_at` in the job
  embeds, extend the shared `CompanyMark` to render an optional image with the
  existing initials fallback, and pass the logo URL from the job employer.
- **Done when:** cards/details show the employer logo when one exists, initials
  otherwise; replacing/removing the logo changes the URL (`?v=updated_at`) so
  the posting shows the new image; tests/lint pass.
- **Out of scope:** application cards, dashboards, admin job tables, the
  employer's own JobPosts table (it shows no company mark), the public employer
  profile (already has the logo), schema changes.

## Server (`server/src/routes/jobs.js`)

- `embed(j)` — add `logo_updated_at: j.logo_updated_at` to the employer object
  (keep `id`, `company_name`, `logo_path`).
- `loadJob` (`GET /jobs/:id`), the public list query, and the
  `GET /employers/:employerId/jobs` list query: select
  `i.updated_at as logo_updated_at` and add
  `left join profile_images i on i.owner_id = e.id and i.kind = 'employer-logo'`
  (one row per kind; counts unaffected).
- Add `logo_updated_at` and `company_id`/`employers`-derived keys as needed to
  the duplicate-job `strip` set so it is never inserted as a column.
- Legacy `logo_path` stays in the payload; the frontend may use an absolute
  http(s) legacy path when no versioned logo exists.

## Frontend

- `src/shared/services/images.js` — add
  `employerLogoUrl(employer = {})`: return `logoUrl(id, logo_updated_at)` when
  both exist; otherwise return an absolute `logo_path` (http/https) or null.
- `src/shared/components/design.jsx` — `CompanyMark` gains an optional `src`
  prop and renders `<img src alt="">` inside the existing rounded mark
  (`size-full object-cover`), falling back to the existing initials when `src`
  is absent or the image errors. Keep the mark `aria-hidden` (the company name
  sits beside it) and leave all existing callers unchanged.
- `src/shared/components/JobCard.jsx` — pass
  `src={employerLogoUrl(job.employers)}` to `CompanyMark`.
- `src/features/job-seeker/JobDetail.jsx` and
  `src/features/public-site/PublicJobDetail.jsx` — same for the large company
  mark.

## Tests

- Server job routes: assert the job detail/list embed includes
  `employers.logo_updated_at` from a mocked profile_images join row, and that
  duplicate-job inserts never include it.
- `src/shared/components/__tests__/JobCard.test.jsx`: an employer with
  `id + logo_updated_at` renders an `<img>` whose `src` contains
  `/employers/<id>/logo` and `?v=`; no logo renders initials; a failed image
  falls back to initials.
- Keep the existing job/company tests passing; run the full suite.

## Acceptance

Focused server jobs + JobCard tests, then `npm test` and `npm run lint`, all
passing. Report commands and counts.
