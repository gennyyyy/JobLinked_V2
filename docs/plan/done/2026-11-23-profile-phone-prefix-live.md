# Profile phone inputs: fixed +63 prefix and live feedback

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** the phone inputs on both profile pages match the job seeker
  registration mobile field: a non-editable `+63` prefix is always visible and
  the user types only the local part (`903 111 1111`). Values stay stored as
  `+63XXXXXXXXXX`.
- **How:** extend the shared `TextField` with an optional `prefix` (rendered with
  the already-imported `InputGroup` primitives), and wire the phone fields with
  `toLocalDigits` (display), `withPrefix` (on change), and `normalizePhone` (on
  blur). Reuse `src/shared/utils/phone.js`; no server or schema change.
- **Live behaviour:** on blur, normalize and show/clear the inline error
  immediately. While an error is visible, re-check on every edit and clear it as
  soon as the number is valid. Save remains the backstop.
- **Decisions (user):** `+63` is predefined; the user supplies only the local
  digits. Employer phones stay format-checked only when filled; job seeker
  Contact number stays required.
- **Out of scope:** server-side formatting/validation, spaces inside the stored
  value, non-PH prefixes, registration pages.

## Files

- `src/shared/components/design.jsx` — `TextField` accepts `prefix`; single-line
  only. Render an `InputGroup` + `InputGroupAddon` (`+63`) + `InputGroupInput`,
  preserving id, required, aria-invalid/describedby, error and help wiring. The
  no-prefix path stays byte-for-byte the current rendering.
- `src/features/job-seeker/Profile.jsx` — Contact number: `value={toLocalDigits(form.phone)}`,
  `prefix="+63"`, `inputMode="numeric"`, `maxLength={10}`; on change store
  `withPrefix(value)` and live-update an existing error; on blur
  `normalizePhone` + validate. Save still sends the `+63` value.
- `src/features/employer/CompanyProfile.jsx` — treat `phone` and
  `representative_phone` as phone fields in `field(name)`: local-digit display,
  `withPrefix` on change, `normalizePhone` + live error on blur, same
  prefix/inputMode/maxLength props. Business phone keeps `type="tel"`.
- Tests: update displayed-value expectations from `+63…` to local digits in
  Profile and CompanyProfile tests (including the resume-autofill contact
  expectation), and add live-feedback coverage: typing an invalid number and
  blurring shows the error before Save; correcting it clears the error; Save
  still blocks while invalid.

## Acceptance

Focused runs over the job seeker Profile and employer CompanyProfile test files,
then `npm test` and `npm run lint`, all passing. Report commands and counts.
