# Employer company phone and representative mobile

Status: approved 2026-11-23 — implement via `fullstack-developer`.
ADR: `docs/arch/adr-057-employer-phone-fields.md`.

## Confirmed brief

- **What:** every field collected on employer registration must survive on the
  company profile. The employer registration form collects a company contact
  number and an authorized representative's mobile; today the representative
  mobile is stored as `employers.phone` and shown as "Business phone", while the
  company contact number is dropped. Keep both, separately:
  - `Company Contact No.` → `employers.phone` (the existing "Business phone").
  - `Representative Mobile` → new `employers.representative_phone`, editable in
    the profile's Representative tab.
- **How:** additive DB column (already written by the architect), client payload
  and service mapping, server provision insert, profile PATCH allow-list, and the
  Company Profile representative field. No backfill of existing rows.
- **Done when:** a new employer registration stores both numbers; the profile
  loads and saves each independently; tests cover registration payload, provision
  insert, PATCH allow-list, and the profile field; `npm test` and `npm run lint`
  pass.
- **Out of scope:** job seeker fields (already fully mapped), public employer
  page, accreditation documents, and phone formatting behaviour.

## Contract

- `buildEmployerSignUpPayload` `extra`:
  - `phone`: `normalizePhone(values.contactNumber)` (unchanged key, corrected source).
  - `representativePhone`: `normalizePhone(values.repMobile)` (new).
- `src/shared/services/auth.js` `signUp` meta: add
  `representative_phone: extra.representativePhone || null`. The parked
  `POST /api/auth/pending-signup` profile therefore carries `representative_phone`
  as a nullable string.
- `POST /api/auth/provision` employer insert: add `representative_phone` to the
  column list and `p.representative_phone ?? null` to the values. Append it after
  `custom_role_id` so existing parameter-index assertions do not shift.
- `GET /api/employers/me`: already `select t.*`; no change.
- `PATCH /api/employers/me`: add `representative_phone` to `EMPLOYER_ALLOW`.
- Company Profile: load `representative_phone` into form state and expose a
  "Representative mobile" `TextField` in the Representative tab. The existing
  Company Profile save sends the whole form, so no extra save logic.

## Schema (written by architect — do not edit)

- `db/schema.sql` — `employers.representative_phone text`.
- `db/migrations/019_employer_representative_phone.sql` — idempotent
  `add column if not exists`, no data moves. Applied by `db/apply-migrations.sh`.

## Implementation files

- `src/features/auth/employerRegistration.js`
- `src/shared/services/auth.js`
- `server/src/routes/auth.js`
- `server/src/routes/profiles.js`
- `src/features/employer/CompanyProfile.jsx`

## Tests to add/update

- `src/features/auth/__tests__/EmployerRegister.test.jsx` — submitted park body
  has `phone: '+63440000000'` from Company Contact No. `440000000`, and
  `representative_phone: '+639171234567'` from Representative Mobile
  `09171234567`.
- `server/src/routes/auth.pending-signup.test.js` — employer provision stores the
  business phone and representative phone in separate insert parameters.
- `server/src/__tests__/profiles.patch.test.js` — `PATCH /api/employers/me` accepts
  `representative_phone`.
- `src/features/employer/__tests__/CompanyProfile.address.test.jsx` — the
  Representative tab loads `representative_phone`, and saving it does not change
  `phone`.

## Acceptance

`npx vitest run` over the four test files above, then `npm test` and
`npm run lint`, all passing. Report the commands and counts.
