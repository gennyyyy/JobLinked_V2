# Plan: Square tag tiles in the Skills & experience tab

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **What:** Redesign the job seeker "Skills & experience" tab so the four tag boxes are square tiles in a 2×2 grid (single column on phones), instead of full-width horizontal strips.
- **Scope:** Preferred Jobs, Preferred Locations, Your Skills, Work Experience only. The Field select stays full-width above the grid; the read-only "Employment through JobLinked" section stays full-width below it.
- **Inside each square:** label above the box, bordered square container, help text below. Chips wrap from the top; the chip area scrolls when full; the text input and Add button stay **inside** the box, pinned to the bottom.
- **Out of scope:** Behavior/payload changes; registration and employer job post form visuals (their TagField rendering must stay exactly as today); chip styling (chips stay pills, only the box is square).

## Design

1. `src/shared/components/TagField.jsx` — add an opt-in `tile` prop (default `false`, current rendering untouched for other callers). When `tile`:
   - Bordered container: `aspect-square`, column layout, content not centered.
   - Chip region: flex-wrap, starts at top, `flex-1 overflow-y-auto` so a full tile scrolls.
   - Input row: stays inside the container, anchored at the bottom with the Add button.
   - Label above, help/error below — as today.
2. `src/features/job-seeker/Profile.jsx` — in the Skills & experience tab:
   - Keep the Field `VocabularyPicker` full-width first.
   - Wrap the four `TagField`s in `<div className="grid gap-4 md:grid-cols-2">` and pass `tile`.
   - Keep the skill vocabulary loading/error/retry feedback adjacent to the Your Skills tile (wrap that tile + feedback in one grid cell).
   - Employment through JobLinked section unchanged, below the grid.
3. Accessibility: keep the input `aria-label={label}`, remove-chip buttons, datalist, and error wiring unchanged.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__` passes (includes Profile.skills, Profile.preferences, Profile.a11y).
- `npm run lint` passes.
- No changes to registration or employer job post form rendering.
