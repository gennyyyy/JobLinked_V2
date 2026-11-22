# Enforce phone format on both profile pages

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** job seeker Profile and employer Company Profile validate phone
  fields with the same rules as registration and store valid values in the same
  `+63XXXXXXXXXX` format.
- **How:** reuse `isValidPhone` / `normalizePhone` from
  `src/shared/utils/phone.js`; no new validator, no server/schema change.
- **Done when:** both pages show an inline error and block saving a malformed
  phone, and save typed `0917…`, `63…`, spaces, or dashes as `+63…`; tests and
  lint pass.
- **Decisions (user):** employer phones are format-checked only when filled
  (blank stays allowed); valid numbers are normalized to `+63` on save.
- **Out of scope:** server-side phone validation (registration is client-side
  too; legacy rows and invite flows may hold other formats), requiredness
  changes, input masking, country codes other than +63.

## Behaviour

Job seeker Profile (`src/features/job-seeker/Profile.jsx`):

- Replace the local `PHONE_PATTERN` with `isValidPhone(form.phone)`; keep the
  Contact number required (invalid includes empty).
- Save `normalizePhone(form.phone)`; after a successful save, update the form
  state to the normalized value so the input matches storage.

Employer Company Profile (`src/features/employer/CompanyProfile.jsx`):

- Before saving, validate `phone` (Business phone) and `representative_phone`
  (Representative mobile) only when non-empty; collect `errors` keyed by field.
- Block the save when either is invalid; pass `error={errors[name]}` to the
  Contact and Representative `TextField`s; clear the field error on change.
- Send `normalizePhone` values in the PATCH and reflect them in form state after
  success. Empty values may stay empty (server already maps `""` to NULL for
  optional columns).

Field error copy: `Enter a valid Philippine contact number (e.g. 917 123 4567).`

## Tests

- `src/features/job-seeker/__tests__/Profile.address.test.jsx` — the existing
  save expectation becomes `+639171234567`; add a test that a malformed contact
  number blocks `updateProfile` and shows the error, and that a spaced typed
  number saves normalized.
- `src/features/employer/__tests__/CompanyProfile.address.test.jsx` — invalid
  Business phone and invalid Representative mobile each block the save with the
  inline error; a valid Business phone typed as `0917 123 4567` is saved as
  `+639171234567`; blank phones do not block.

## Acceptance

Focused Vitest run over the two test files, then `npm test` and `npm run lint`,
all passing. Report commands and counts.
