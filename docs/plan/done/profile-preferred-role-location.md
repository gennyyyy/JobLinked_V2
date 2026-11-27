# Plan: Restore Preferred Jobs & Preferred Locations to the Job Seeker Profile

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **What:** Restore the Preferred Jobs and Preferred Locations tag fields to the job seeker profile page. They were removed in commit `4565972` ("rebuild the job seeker profile to match the new design").
- **Placement:** "Skills & experience" tab, grouped with the matching inputs (Field, Your Skills, Work Experience).
- **Scope:** Both fields (`preferred_position` and `preferred_location`), as confirmed by the user. Restoring both also makes the Dashboard checklist item "Preferred role and location" (`src/features/job-seeker/Dashboard.jsx:240`) satisfiable; matching already scores both (`Dashboard.jsx:30-31`, `server/src/matching/score.js`).
- **Out of scope:** No database schema change. No server change — `server/src/routes/profiles.js:18` already whitelists `preferred_position` and `preferred_location` for profile updates. No change to matching rules or Dashboard.

## Design

Data format: comma-separated tag strings, matching the existing `experience_summary` pattern and the `splitPref` parser used by Dashboard.

In `src/features/job-seeker/Profile.jsx`:

1. `EMPTY_FORM`: add `preferredPosition: ''`, `preferredLocation: ''`.
2. `formFromUser(user)`: map `user.preferred_position || ''` and `user.preferred_location || ''`.
3. `handleSubmit` patch: add `preferred_position: form.preferredPosition.trim() || null` and `preferred_location: form.preferredLocation.trim() || null`.
4. "Skills & experience" tab: add two `TagField` inputs (existing component in `src/shared/components/TagField.jsx`, string/array-compatible):
   - Label "Preferred Jobs" — placeholder e.g. "Type a role and press Enter", help text noting it powers job matching.
   - Label "Preferred Locations" — same pattern, e.g. "Type a location and press Enter".
   - Place them after the Field picker and before Your Skills, keeping the tab's matching-related inputs together. Use the old labels ("Preferred Jobs" / "Preferred Locations") since this is a restore.

## Tests

New file `src/features/job-seeker/__tests__/Profile.preferences.test.jsx`, following the harness in `Profile.skills.test.jsx` (mock useAuth, auth.updateProfile, seekers, documents, reference):

1. Stored `preferred_position` / `preferred_location` render as removable chips in the Skills & experience tab.
2. Typing tags with Enter/comma and saving sends `preferred_position` / `preferred_location` as comma-separated strings in the `updateProfile(id, patch)` payload.
3. Saving with both empty sends `null` for both.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__/Profile.preferences.test.jsx` passes.
- Existing `src/features/job-seeker/__tests__/Profile.skills.test.jsx` (and other Profile tests) still pass.
- `npm run lint` passes.
