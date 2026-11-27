# Rename "Preferred Role" Copy to "Preferred Jobs" (UI Wording Only)

**Status:** Confirmed by user 2026-11-28. Bounded change.

## What

The job-seeker Profile page labels the field "Preferred Jobs". Two other UI strings still say "preferred role"; rename them for consistency.

## Exact changes

1. `src/features/job-seeker/Dashboard.jsx:232`
   - `{ label: 'Preferred role and location', done: ... }` → `{ label: 'Preferred jobs and location', done: ... }`
2. `src/shared/components/PreferenceMatching.jsx:35`
   - `Tell me about your preferred role, skills, location, or work arrangement.` → `Tell me about your preferred jobs, skills, location, or work arrangement.`

## Constraints

- UI wording only. Do NOT rename the `preferred_position` DB column, API field, form state keys, or server matching logic.
- Do not touch the Profile page (already correct), super-admin views, or legal copy.
- No tests assert these two strings; no test updates expected.

## Done when

- Grep finds no `preferred role` / `Preferred role` in `src/`.
- `npm run lint` passes.
- `npx vitest run src/features/job-seeker src/shared` passes.
