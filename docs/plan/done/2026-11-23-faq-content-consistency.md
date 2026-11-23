# FAQ consistency with How It Works and PESO Services

Status: approved 2026-11-23 — implement via `frontend`.

## Audit result

Nine FAQ answers match the two pages. Two conflict:

1. **“Can I apply without a resume?”** — claims a resume is required and that no file
   contents are uploaded/stored. How It Works says “choose your sample resume”; the app
   stores uploaded résumés and the Privacy Notice covers them. The PDF limit is also 2 MB,
   not 5 MB.
2. **“Are PESO programs processed online?”** — “program pages are informational” conflicts
   with the PESO Services page, where job matching tells users to create an account and
   apply on JobLinked.

## Copy fixes

Replace answer 1 with:

“You can apply without attaching a resume — your application sends your JobLinked profile.
If you attach one, upload a PDF up to 2 MB or a DOC or DOCX up to 5 MB, then choose it
before submitting.”

Replace answer 2 with:

“Job matching and applications run on JobLinked. The other PESO services listed — community
job fairs, career guidance, and skills and livelihood training — are informational here:
confirm schedules, eligibility, and requirements with the PESO office. JobLinked does not
process SPES, GIP, or other government transactions.”

Keep every other FAQ entry unchanged.

## Out-of-scope findings (report, do not change)

- How It Works job-seeker step 3 mentions an “optional cover letter”; the application form
  has no cover-letter field.
- How It Works and the FAQ both say unaccredited employers may draft jobs, but the employer
  portal currently blocks creating a post until accreditation is approved. Needs a
  product decision: change copy or allow drafts.

## Tests

`Faq.test.jsx` iterates `FAQS`; keep it green. No new assertions required.

## Acceptance

`npx vitest run src/features/public-site/__tests__/Faq.test.jsx`, then `npm test` and
`npm run lint`, all passing.
