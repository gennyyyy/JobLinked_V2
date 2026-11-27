# Plan: Help text under the label in profile tiles

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **What:** In the job seeker profile's Skills & experience tiles, move each field's help/description text directly below its header label, above the input box. Example: "The roles you want to be matched with." sits under "Preferred Jobs".
- **Scope:** Only the tile variant used by Profile (Preferred Jobs, Preferred Locations, Your Skills, Work Experience). Default rendering in registration and the employer job form stays unchanged.
- **Errors:** stay below the box, next to the input.
- **Out of scope:** Text content changes, behavior changes, other screens.

## Design

1. `src/shared/components/TagField.jsx` — in `tile` mode only, render `helpText` immediately after the label (with the `helpId` unaffected; there is no aria-describedby wiring here today). Keep error below the box. Default branch renders help exactly as now (below the box).
2. `src/shared/components/VocabularyPicker.jsx` — in the `tile` multiple variant only, render the help paragraph right below the label using the existing `helpId` (so `aria-describedby` keeps working). Exclude help from `PickerFeedback` in tile mode; loading/loadError/error stay below the box as today. Non-tile rendering unchanged.
3. Spacing: label bottom margin tightens, help gets its own bottom margin before the box, so tiles keep equal heights.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__ src/shared/components/__tests__/VocabularyPicker.test.jsx` passes.
- `npm run lint` passes.
- Non-tile consumers (registration, employer job post form) render unchanged.
