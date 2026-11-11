# Plan

Align the job-seeker and employer profile pages with persistent information collected during registration. Reuse existing profile columns and education records where possible, and treat employer representative birthday as a schema change only after architect approval.

## Scope
- In: Job-seeker birthday, employment status, registration address details, name components, and structured education; audit employer profile fields against registration; add focused tests and verify persistence.
- Out: Passwords, one-time consent acknowledgements, and editing the authentication login email; any employer birthday schema change without architect approval.

## Action items
[x] Compare registration forms and payload builders with profile forms, API allow-lists, and database fields; identify persistent fields missing from each profile.
[x] Add missing job-seeker personal and address fields to [Profile.jsx](../../src/features/job-seeker/Profile.jsx), including birthday, employment status, name components, and registration address components.
[x] Load and save job-seeker fields through the existing `/seekers/me` API, preserving existing values and the read-only authentication email.
[x] Add structured education management using the existing `education` table and [seeker services](../../src/shared/services/seekers.js), including school, level, field, graduation year, and currently-studying state; add an ownership-checked update endpoint in [profiles.js](../../server/src/routes/profiles.js) if needed.
[x] Compare employer registration payload fields with [CompanyProfile.jsx](../../src/features/employer/CompanyProfile.jsx); expose any missing persistent company, contact, address, or representative fields while keeping the login email read-only.
[x] Obtain architect approval before adding employer representative birthday storage; if approved, update [schema.sql](../../db/schema.sql), [registration provisioning](../../server/src/routes/auth.js), the profile API, and migration process, otherwise leave the field out of profile persistence. (Decision: not approved in this pass; employer rep birthday stays un-persisted.)
[~] Add focused component and route tests for loading, editing, validation, and saving the newly exposed fields, including education create/update/delete behavior. (Existing tests updated; no new dedicated suites added.)
[x] Cover edge cases such as legacy profiles with blank fields, optional education records, and currently studying entries with no graduation year; surface API failures without losing the user’s draft.
[x] Run the focused tests, `npm test`, `npm run lint`, `npm run build`, and `git diff --check`; resolve regressions before considering the work complete.

## Open questions
- Has architect approval been granted to persist the employer representative’s birthday with a database schema change?
