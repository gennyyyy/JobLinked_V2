# Plan: Remove the blue focus border/ring from profile tag tiles

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **Issue:** Focusing anything inside a tag tile (e.g. clicking a location checkbox) applies `focus-within:border-ring` + `focus-within:ring-3 focus-within:ring-ring/50`, turning the whole card's border blue with a blue ring. All four tag tiles share this effect.
- **Decision:** Remove the card-level focus effect entirely from the tile variants — both the blue border color change and the ring — for mouse and keyboard focus alike. Chip-level `peer-focus-visible` rings stay.
- **Keep:** the resting gray `border border-input` on the tiles (the cards stay bordered at rest).
- **Scope:** only the `tile` variants of `TagField` and `VocabularyPicker`. Default rendering in registration and the employer job form keeps its current focus styling. Employment through JobLinked unchanged.

## Change

1. `src/shared/components/TagField.jsx` — tile container: remove `focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50`; keep everything else.
2. `src/shared/components/VocabularyPicker.jsx` — tile container classes: remove the same `focus-within:*` classes; keep the resting border and layout.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__ src/shared/components/__tests__/VocabularyPicker.test.jsx` passes.
- `npm run lint` passes.
- Non-tile consumers render and focus unchanged.
