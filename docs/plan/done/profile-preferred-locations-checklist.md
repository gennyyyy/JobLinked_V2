# Plan: Preferred Locations as a barangay checklist

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **What:** Replace the free-text "Preferred Locations" tag box in the job seeker profile with a checkbox checklist of the 24 `SANTA_MARIA_BARANGAYS` (same list job postings use for their location), so seekers can check multiple preferred locations.
- **Layout:** Keep it as one tile in the existing 2×2 grid; the 24-item checklist scrolls inside the 2:1 tile box.
- **Data:** Unchanged format — still saved as a comma-separated string in `preferred_location`, so matching (`server/src/matching/score.js`), the Dashboard checklist, and employer/admin display keep working. Legacy free-text values render as checked items (VocabularyPicker already appends unknown selected values).
- **Out of scope:** No schema, server, or matching changes. No other profile field changes.

## Design

1. `src/shared/hooks/useVocabulary.js` — add an `enabled` flag (default true). When disabled, skip the fetch and report `{ values: [], loading: false, error: '' }`. Existing callers unchanged.
2. `src/shared/components/VocabularyPicker.jsx` —
   - Accept optional `options` (static list). When provided, render those instead of fetched values, skip fetch feedback/loading, and derive canonical order from the static list.
   - Add an opt-in `tile` prop for the multiple variant: 2:1 bordered box (same visual frame as TagField's tile), checkbox-chip area wraps and scrolls inside, label above and help below.
3. `src/features/job-seeker/Profile.jsx` — replace the Preferred Locations `TagField` with:
   - `<VocabularyPicker multiple tile label="Preferred Locations" options={SANTA_MARIA_BARANGAYS} value={form.preferredLocation} onChange={(values) => setField('preferredLocation', values.join(', '))} ... />`
   - Keep it in the grid; keep the payload line `preferred_location: form.preferredLocation.trim() || null` (string stays).
   - `SANTA_MARIA_BARANGAYS` is already imported.
4. Accessibility: role=group labelled by the field label (VocabularyPicker already does this), native checkboxes, each check/uncheck immediately updates the payload.

## Tests

- `src/features/job-seeker/__tests__/Profile.preferences.test.jsx` — update the Preferred Locations cases:
  - Stored values render as checked checkboxes (e.g. `Bocaue` checked; a non-listed legacy value still checked).
  - Checking/unchecking barangays updates the payload as a comma-separated string in list order.
  - Empty selection saves `null`.
- `src/shared/components/__tests__/VocabularyPicker.test.jsx` — add a static-`options` multiple case (renders all options, emits on check).

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__ src/shared/components/__tests__/VocabularyPicker.test.jsx` passes.
- `npm run lint` passes.
