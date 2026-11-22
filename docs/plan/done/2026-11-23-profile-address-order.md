# Profile address order matches the registration forms

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** reorder the address fields on both profile pages to the same sequence
  used by their registration forms. Labels, options, validation, and stored
  values stay unchanged; this is a layout-order change only.
- **Job seeker order (registration `JobSeekerAddressStep`):**
  Lot, Block → Street address → Subdivision/Village/Building → Barangay →
  City/Municipality → Province → Postal code.
- **Employer order (registration `EmployerCompanyStep`):**
  House/Building/Unit → Street address → Subdivision/Village/Building →
  Barangay → City/Municipality → Province → Postal code.
  The Contact & location tab's email/phone block stays above the address block.
- **Done when:** both profile Address sections render the fields in those
  orders, existing tests pass, and lint is clean.
- **Out of scope:** field labels, dropdown options, requiredness, validation,
  registration pages, server/schema.

## Implementation

- `src/features/job-seeker/Profile.jsx` Address tab, replace the current rows
  (Lot/Block, Barangay/Street, Subdivision/City/Province/Postal) with:
  1. Lot | Block
  2. Street or local address | Subdivision / Village / Building
  3. Barangay | City / Municipality
  4. Province / State | Postal Code
  Reuse the existing field components, handlers, ids, errors and options.
- `src/features/employer/CompanyProfile.jsx` Contact & location tab:
  - `ADDRESS_FIELDS` keeps house_number_unit, street_address,
    subdivision_building only; remove postal_code from that list.
  - After the address grid, render a grid with the Barangay select and the
    City / Municipality select, then a grid with the Province / State select and
    the Postal Code TextField. Keep the existing `field(...)` wiring, options,
    legacy barangay handling, and placeholders.
  - Keep the Contact fields block above the address block.

## Acceptance

`npx vitest run src/features/job-seeker/__tests__/Profile.address.test.jsx src/features/employer/__tests__/CompanyProfile.address.test.jsx`,
then `npm test` and `npm run lint`, all passing. Report commands and counts.
