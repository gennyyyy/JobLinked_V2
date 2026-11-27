# Plan: Fix checked-chip hover contrast in Preferred Locations

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **Bug:** In the Preferred Locations checklist, hovering a checked (active) chip turns its background to `--secondary` (#f0f5fc, near-white) via `hover:bg-secondary` while the text stays white (`peer-checked:text-primary-foreground`), making it unreadable.
- **Fix:** Give checked chips their own hover background so they stay solid blue: add `peer-checked:hover:bg-primary` to the `CHIP` constant in `src/shared/components/VocabularyPicker.jsx`.
- **Scope:** One class in the shared chip style. Unselected chips keep the existing light hover. No behavior, layout, or other component changes.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__ src/shared/components/__tests__/VocabularyPicker.test.jsx` passes.
- `npm run lint` passes.
