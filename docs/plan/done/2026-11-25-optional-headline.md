# Professional headline is optional

Status: approved 2026-11-25 — implement via `frontend`.

## Confirmed brief

- **What:** the job-seeker profile no longer requires a professional headline.
- **How:** remove the `headline` validation rule and the field's `required` marker; keep
  the input, and keep saving whatever the seeker types.
- **Done when:** saving a profile with an empty headline succeeds; no headline error is
  shown; tests/lint pass.
- **Out of scope:** removing the field, other validations, server/API.

## Changes

- `src/features/job-seeker/Profile.jsx`:
  - delete the `if (form.headline.trim().length < 5) next.headline = ...` line;
  - `<TextField label="Professional Headline" ...>` loses `required` and
    `error={errors.headline}` (nothing sets it now); keep value/onChange.
- `src/features/job-seeker/__tests__/Profile.address.test.jsx`:
  - remove the `'Add a short professional headline.'` assertion from the blocked-save
    test;
  - add a focused test: clear the headline, save, and `updateProfile` is called (the
    other required fields stay valid).

Preserve any concurrent edits in these files; change only the headline logic.

## Acceptance

`npx vitest run src/features/job-seeker/__tests__/Profile.address.test.jsx`, then
`npm test` and `npm run lint`, all passing.
