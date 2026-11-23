# FAQ: employer questions and data use

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** extend `FAQS` with four employer questions (documents, 3-business-day review,
  posting, rejection) and one question on how data is used.
- **How:** add entries to `src/shared/constants.js`; the FAQ page maps the constant, so no
  page markup change is needed.
- **Done when:** the questions render in order on `/faq` and the existing FAQ test passes.
- **Out of scope:** other public copy, employer portal changes, legal document text.

## Copy (exact)

Insert after “How are employers verified?”:

1. Q: “What documents do I need for employer accreditation?”
   A: “Upload one file for each of the nine requirements in the Employer portal: Letter of
   Intent, Company Profile, Business Permit, DOLE Certificate, Job Orders, PhilJobNet
   Accreditation, Pag-IBIG Registration, PhilHealth Registration, and Fire Safety
   Inspection Certificate. Accepted files are PDF up to 2 MB, or DOC, DOCX, PNG, or JPG up
   to 5 MB. In this sample environment, the uploads are fictional.”

2. Q: “How long does employer accreditation take?”
   A: “PESO aims to review a complete accreditation application within about 3 business
   days. The count starts after all required documents are submitted and the company email
   is verified. Review times can vary; the current status is always shown on the Employer
   portal’s Accreditation page.”

3. Q: “Can I post jobs before my accreditation is approved?”
   A: “You can create and save job drafts at any time, but publishing is blocked until PESO
   approves your accreditation. Once approved, publish directly from Job Management. Posts
   that mention fees or payments may be held for PESO clearance before they appear
   publicly.”

4. Q: “What happens if my accreditation is rejected?”
   A: “The reviewer’s remarks appear on your Accreditation page and in the review history.
   Update or replace the flagged documents there, then wait for PESO to review again.
   Drafts stay available, but publishing remains blocked until the accreditation is
   approved.”

Insert after “Can I apply without a resume?”:

5. Q: “How is my data used on JobLinked?”
   A: “Profile and application details are used to create and manage your account, match
   you with vacancies, process applications, send service notifications, and prepare
   authorized PESO employment reports. Employers receive only the information for
   applications submitted to their own vacancies, and only for recruitment. Your profile is
   not sold or published as a public applicant directory. See the Privacy notice for
   retention rules and your rights.”

## Tests

- `src/features/public-site/__tests__/Faq.test.jsx` already iterates `FAQS`; keep it green.
  Add assertions that the five new questions are present.

## Acceptance

`npx vitest run src/features/public-site/__tests__/Faq.test.jsx`, then `npm test` and
`npm run lint`, all passing.
