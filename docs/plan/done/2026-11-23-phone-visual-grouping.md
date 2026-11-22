# Visual phone grouping (spaces are display-only)

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** every phone input shows grouped digits as the user types
  (`917 123 4567`, `440 000 000`), matching the existing `+63` prefix. The form
  state, PATCH/sign-up payloads, and DB values stay space-free (`+63XXXXXXXXXX`
  or local digits as each flow already stores them). Spaces are purely a
  frontend display transform.
- **How:** one helper in `src/shared/utils/phone.js` formats the displayed value;
  every change handler immediately converts the formatted text back to digits
  with the existing `toLocalDigits` / `withPrefix` helpers. No server, schema, or
  storage change.
- **Grouping:** 3-3-4 from the left (`917 123 4567`; 9 digits → `917 123 456`),
  matching the user's example.
- **Done when:** typing in any phone box inserts spaces visually; the submitted
  value contains none; every phone field still validates and normalizes as
  before; tests and lint pass.
- **Out of scope:** spaces in stored values, cursor-jump engineering, phone
  validation rule changes, non-PH prefixes.

## Helper

`formatPhoneDisplay(value)` in `src/shared/utils/phone.js`:

- `const digits = toLocalDigits(value)` (handles `+63…`, `0…`, pasted spaces).
- Group the first 3, next 3, then the rest with single spaces.
- Empty stays empty.

## Inputs to update

1. `src/features/auth/JobSeekerPersonalStep.jsx` — Mobile Number:
   `value={formatPhoneDisplay(form.mobileNumber)}`; keep `withPrefix` onChange
   and `normalizePhone` onBlur; remove `maxLength` (the helper caps at 10 digits).
2. `src/features/auth/EmployerCompanyStep.jsx` — Company Contact No.:
   `value={formatPhoneDisplay(form.contactNumber)}`; onChange stores
   `toLocalDigits(value)`; remove `maxLength`.
3. `src/features/auth/EmployerRepresentativeStep.jsx` — Representative Mobile:
   same treatment.
4. `src/features/job-seeker/Profile.jsx` — Contact number:
   `formatPhoneDisplay(form.phone)`; remove `maxLength`; existing prefix,
   withPrefix, normalize/validate behavior stays.
5. `src/features/employer/CompanyProfile.jsx` — `phone` and
   `representative_phone` in `field(name)`: formatted display; remove
   `maxLength`; existing prefix, withPrefix, blur validation stays.
6. `src/features/super-admin/UserManagement.jsx` — invite Phone: add the same
   fixed `+63` prefix (existing `InputGroup` primitives), display
   `formatPhoneDisplay(inviteForm.phone)`, store `withPrefix(...)` on change and
   `normalizePhone(...)` on blur so the invite payload stays space-free.

The `+63` prefix stays a live addon beside the input, not part of its value.

## Tests

- `src/shared/utils/__tests__/phone.test.js` — formatter covers 10-digit,
  9-digit, partial, pasted `+63`/spaced and empty values; asserts no spaces in
  `toLocalDigits`/`withPrefix` output.
- Update display-value assertions caused by the grouping in
  `Profile.address.test.jsx`, `ProfileResumeAutofill.test.jsx`, and
  `CompanyProfile.address.test.jsx` (e.g. `9171234567` → `917 123 4567`); saved
  values stay `+63…`.
- Add at least one registration-page assertion that the typed input displays
  grouped digits while the parked payload has none.
- Add one admin-invite assertion that the phone input groups and the invite
  payload is space-free (`+63…`).

## Acceptance

Focused runs over the phone util, both profile suites, the registration suites,
and the invite suite; then `npm test` and `npm run lint`, all passing. Report
commands and counts.
