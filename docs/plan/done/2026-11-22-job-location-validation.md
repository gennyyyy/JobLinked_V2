# Job Location Validation (Santa Maria barangays)

## Problem
POST/PATCH /api/jobs (and admin PATCH) accept any free-text `location`. E2E test confirmed an employer can post a job with location "Manila". Requirement: location must be one of the 24 validated Santa Maria, Bulacan barangays.

## Scope
- Server-side validation only (frontend already restricts via dropdown).
- Location may be a bare barangay name ("Poblacion") or a full string ("Poblacion, Santa Maria, Bulacan") — validate the barangay part.
- null/empty location remains allowed (nullable column).

## Design
- Add `JOB_LOCATIONS` const in `server/src/routes/jobs.js` = the 24 barangays (mirror of `SANTA_MARIA_BARANGAYS`), exported.
- Add helper `isValidJobLocation(loc)`:
  - null/''/undefined → true
  - else extract part before first comma (or whole), trim, case-insensitive match against JOB_LOCATIONS.
- POST /jobs: if `b.location` provided and !isValid → 400 BAD_REQUEST.
- PATCH /jobs: if `patch.location` provided and !isValid → 400.
- admin-jobs.js PATCH: same check.
- Export `JOB_LOCATIONS` and `isValidJobLocation` for tests.

## Done when
- POST with location "Manila" → 400.
- POST with "Poblacion" / "Poblacion, Santa Maria, Bulacan" → 201.
- Existing tests pass.
