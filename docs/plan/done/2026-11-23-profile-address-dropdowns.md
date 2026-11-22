# Profile address location fields: predefined dropdowns

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** on both profile pages, Barangay, City / Municipality, and Province
  are predefined dropdowns. Barangay already is; City / Municipality and
  Province change from free text to selects.
- **Lists:** `SANTA_MARIA_BARANGAYS` for barangay, `BULACAN_MUNICIPALITIES` for
  city/municipality, and Bulacan only for province (matching registration's
  PESO scope).
- **Legacy values (user decision):** force a new pick. When a stored city or
  province is not in the predefined list, the profile loads that field empty
  (placeholder visible) so saving persists the blank until the user chooses a
  valid option. Do not add out-of-list values as extra options. Barangay keeps
  its existing legacy-option behavior.
- **Done when:** both profile Address sections render selects for all three
  fields, options come from the shared constants, stored in-list values load,
  out-of-list city/province load blank, saves persist selections, and tests/lint
  pass.
- **Out of scope:** registration pages, changing requiredness (job seeker
  barangay/street remain required; city/province stay optional; employer
  requiredness unchanged), new geography data, server/schema changes.

## Implementation

- `src/shared/constants.js` — add `BULACAN_PROVINCES = ['Bulacan']` next to
  `BULACAN_MUNICIPALITIES` with a one-line comment (PESO scope).
- `src/features/job-seeker/Profile.jsx`
  - Import `BULACAN_MUNICIPALITIES` and `BULACAN_PROVINCES`.
  - In `formFromUser`, title-case the stored city/province and keep them only
    when they match the lists; otherwise `''`.
  - Replace the City / Municipality and Province / State `TextField`s with
    `SelectField`s using the constants and placeholders
    `Select city / municipality` / `Select province`; keep the existing
    `setField` handlers.
- `src/features/employer/CompanyProfile.jsx`
  - Import the two constants.
  - In the `getEmployer` → form mapping, apply the same membership check to
    `city_municipality` and `province_state` (title-cased; blank when not in the
    list).
  - Remove `city_municipality` and `province_state` from `ADDRESS_FIELDS` and
    render two `SelectField`s (same labels/placeholders) beside the address
    grid, before the Barangay select. Use `field(name)` for id/value/onChange.
  - Leave the Barangay select and its legacy-option handling unchanged.

## Tests

- `src/features/job-seeker/__tests__/Profile.address.test.jsx` — city/province
  render as `SELECT` with the expected options and load stored in-list values;
  an out-of-list stored city/province renders the placeholder; saving sends the
  selected/blank values.
- `src/features/employer/__tests__/CompanyProfile.address.test.jsx` — same
  checks for the employer profile; existing load/save tests keep passing.
- Run the two focused suites, then `npm test` and `npm run lint`.
