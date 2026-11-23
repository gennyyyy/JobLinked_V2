# Use the numeral in business-day copy

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** replace the spelled-out “three” with “3” in every user-facing “three business
  days” label.
- **Scope (all occurrences):**
  1. `src/features/auth/EmployerRegister.jsx` step banner:
     “Accreditation takes about three business days.” → “about 3 business days.”
  2. `src/features/public-site/HowItWorks.jsx` employer step description: same change.
  3. `src/shared/constants.js` accreditation description: same change.
- **Already correct:** the employer confirmation modal uses “3 business days”; leave it.
- **Out of scope:** unrelated “three roles/audiences” copy, docs, tests (none assert these
  strings), other wording.
- **Done when:** no user-facing “three business days” remains; tests/lint pass.

## Acceptance

`npm test` and `npm run lint`, all passing.
