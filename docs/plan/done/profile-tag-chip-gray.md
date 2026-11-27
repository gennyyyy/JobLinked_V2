# Plan: Gray tag chips in profile tiles

Status: **approved — confirmed with user 2026-11-28**
Owner: frontend agent
Created: 2026-11-28

## Confirmed brief

- **What:** In the job seeker profile's tag tiles (Preferred Jobs, Your Skills, Work Experience), the tag chips should stop being blue and match the inactive Preferred Locations chip: gray background, gray border, muted text, same pill shape.
- **Scope:** Only the `tile` variant of `TagField`. Registration and the employer job post form keep the current blue chips.
- **Remove button:** stays; its hover becomes the light gray `hover:bg-secondary` instead of the blue tint.

## Change

`src/shared/components/TagField.jsx` — hoisted `chips` markup gains a mode-dependent class:
- tile: `border border-border bg-muted text-muted-foreground` (+ existing rounded-full, padding, text size, font weight); remove-button hover `hover:bg-secondary`.
- default (non-tile): unchanged `bg-primary/10 text-primary`, remove-button hover `hover:bg-primary/15`.

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__` passes.
- `npm run lint` passes.
- Non-tile consumers render unchanged.
