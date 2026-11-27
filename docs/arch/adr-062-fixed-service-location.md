# ADR-062: Fixed service location — Santa Maria, Bulacan only

**Status:** Accepted
**Date:** 2026-11-27

## Context

The product scope changed: this portal is exclusive to Santa Maria, Bulacan.
Today the province/city fields are selectable dropdowns on every address surface
(both registration flows, employer CompanyProfile, job-seeker Profile,
resume builder), and the Express API accepts and stores whatever the client
sends. Barangay was already locked to the 24 Santa Maria barangays
(`SANTA_MARIA_BARANGAYS`).

## Decision

1. **Server is the source of truth.** Every write path that stores
   `city_municipality` / `province_state` clamps them to `'santa maria'` /
   `'bulacan'` (lowercase, matching the existing storage convention):
   - `server/src/routes/auth.js` — the `/auth/provision` handler (covers
     self-signup via `pending_signups` and admin invites, both roles).
   - `server/src/routes/profiles.js` — the shared `meRoutes` PATCH handler
     (covers `/seekers/me` and `/employers/me`), clamped only when the key is
     present so untouched patches still behave identically.
2. **Client renders them read-only.** The two registration address steps, both
   profile edit forms, and the resume builder show Province = Bulacan and
   City/Municipality = Santa Maria as disabled, prefilled fields with no
   onChange. Form initial state is prefilled with the constants.
3. Single source of the values on the client: `FIXED_PROVINCE` /
   `FIXED_MUNICIPALITY` in `src/shared/constants.js`. The server duplicates the
   literals (it cannot import the client's aliased module) with a comment
   pointing back here.
4. Postal code stays editable/optional. Barangay is unchanged (already
   SM-only). No schema change.

## Consequences

- Legacy rows holding another LGU keep their stored value until the owner
  saves; the edit forms always show the fixed values and every save rewrites
  the row to them, so old data converges.
- A modified client can no longer register or save profiles outside
  Santa Maria, Bulacan.
- `pickListed` normalization for these two fields is no longer needed; the
  general helper stays (barangay/other lists still use it).
