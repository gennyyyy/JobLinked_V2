# Confirmation dialog Cancel button — neutral, no primary fill

Status: approved 2026-11-25 — implement via `frontend` agent.

## Confirmed brief

- **What:** In the confirmation dialog (opened by the resume card's Delete and
  every other `ConfirmationModal` caller), the Cancel button currently inherits
  the shared `Button` default variant's `bg-primary`, so it renders as a blue
  filled button with a muted label. Cancel must be a neutral button: no fill,
  existing border and muted label, gray hover.
- **How:** `src/shared/components/ConfirmationModal.jsx` — pass
  `variant="ghost"` to the Cancel `Button`. `cn`/`tailwind-merge` then drops
  `bg-primary` while keeping the explicit `border border-border
  text-muted-foreground hover:bg-muted` classes. One prop; no other files.
- **Done when:** the confirmation dialog's Cancel has no blue fill;
  `npm test` and `npm run lint` pass.
- **Out of scope:** Confirm/Delete button styling (danger red stays), other
  buttons, dialog layout/copy.

## Files

- Modify `src/shared/components/ConfirmationModal.jsx`
- Modify `src/shared/components/__tests__/ConfirmationModal.test.jsx` — one
  regression assertion in the default-labels test:
  `expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('bg-primary')`

## Verify

- `npx vitest run src/shared/components/__tests__/ConfirmationModal.test.jsx`
- `npm test`
- `npm run lint`
