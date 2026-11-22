# ADR-057 — Employer business phone and representative mobile are separate fields

- **Status:** Accepted
- **Date:** 2026-11-23
- **Plan:** `docs/plan/2026-11-23-employer-phone-fields.md`

## Context

The employer registration form collects two phone numbers:

- **Company Contact No.** (`contactNumber`) — validated, but `buildEmployerSignUpPayload`
  never sent it, the `employers` table has no column for it, and the profile has no
  field for it. The value was discarded.
- **Representative Mobile** (`repMobile`) — sent as `extra.phone`, stored in
  `employers.phone`, and displayed on the profile as **Business phone**.

The profile's Company Profile therefore showed one phone value under two meanings:
the field labelled "Business phone" actually held the authorized representative's
mobile, and the representative tab had no mobile field. Editing "Business phone"
silently overwrote the representative's number.

Option (a) from the registration/profile field audit: every field collected at
registration must land in a profile field. Both phone values must be kept.

## Decision

1. **`employers.phone` is the company/business contact number.** Registration's
   `Company Contact No.` maps to it and the profile edits it under the existing
   "Business phone" label in Contact & location.
2. **New `employers.representative_phone` holds the authorized representative's
   mobile.** Registration's `Representative Mobile` maps to it; the profile's
   Representative tab exposes it.
3. Both columns are independently editable through `PATCH /api/employers/me`;
   `GET /api/employers/me` returns them. The self-signup profile passed through
   `POST /api/auth/pending-signup` carries `representative_phone` alongside the
   existing `phone` key.
4. **Additive migration, no backfill.** Existing rows keep their current `phone`
   value because the profile may already have replaced it with a real business
   number. Existing representatives see their old mobile under "Business phone"
   and an empty "Representative mobile" until they correct it. No value is moved
   or deleted automatically.

## Consequences

- New registrations store the company contact and the representative mobile in
  distinct columns; neither is lost.
- The profile cannot silently overwrite one number with the other.
- Existing employer rows may need a one-time manual correction; the additive
  migration is safe to roll back by dropping the column.
- No API shape changes beyond one optional field in the employer profile payload.

## Not in scope

Job seeker fields (their registration data already maps fully to the profile),
the public employer page, accreditation documents, and any phone formatting
change beyond the existing `normalizePhone` behaviour.
