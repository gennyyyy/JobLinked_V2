# Account creation modal: layout and spacing

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** replace the cramped shared `ConfirmationModal` used for job-seeker account
  creation with a dedicated modal that has room for the explanation and properly spaced
  buttons.
- **How:** new `src/features/auth/AccountCreationModal.jsx` built on `@/components/ui/dialog`
  (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`) —
  `sm:max-w-xl`, `p-6`, `gap-5`, visible title, bordered footer with `gap-3`,
  `min-h-10` buttons, stacked full-width on mobile and right-aligned on desktop.
- **Done when:** the modal is visibly wider/roomier, the buttons have even spacing and
  full hit targets, all copy and behavior (confirm/cancel/busy/error) are unchanged, and
  tests/lint pass.
- **Out of scope:** other `ConfirmationModal` call sites, copy changes, the registration
  flow logic.

## Changes

### `src/features/auth/AccountCreationModal.jsx` (new)

Props: `open`, `error`, `busy`, `onConfirm`, `onCancel`.

```jsx
<Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel() }}>
  <DialogContent className="gap-5 p-6 sm:max-w-xl">
    <DialogHeader>
      <DialogTitle className="text-xl">Confirm account creation</DialogTitle>
      <DialogDescription>
        Your account isn't active until you open the verification link and sign in.
      </DialogDescription>
    </DialogHeader>

    <section className="rounded-xl border border-border bg-muted/60 p-4 text-xs leading-6 text-muted-foreground">
      <h3 className="text-sm font-semibold text-dark-blue">What happens after you create your account</h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4">
        <li>We email a verification link to the address you entered.</li>
        <li>Your account activates only after you open that link and sign in — the link expires in 1 hour.</li>
        <li>The details you entered are saved and applied to your profile automatically.</li>
      </ol>
      <p className="mt-3"><strong className="font-semibold text-dark-blue">“Verified”</strong> means we confirmed the email belongs to you. Job seekers do not need PESO accreditation.</p>
    </section>

    {error && <div role="alert" className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">{error}</div>}

    <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="min-h-10 w-full px-5 sm:w-auto" onClick={onCancel} disabled={busy}>Keep editing</Button>
      <Button type="button" className="min-h-10 w-full px-5 sm:w-auto" onClick={onConfirm} disabled={busy}>
        {busy ? 'Creating account…' : 'Confirm & Create Account'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### `src/features/auth/JobSeekerRegister.jsx`

- Import and render `AccountCreationModal` instead of `ConfirmationModal`, passing
  `open={confirmOpen}`, `error`, `busy`, `onConfirm={finalizeAccount}`,
  `onCancel={() => { if (!busy) setConfirmOpen(false); }}`.
- Remove the now-unused `ConfirmationModal` import and inline modal children/markup.

### `src/shared/components/ConfirmationModal.jsx`

- Remove the `confirmDisabled` prop added for the previous modal; no other change.

## Tests

- `src/features/auth/__tests__/JobSeekerRegister.test.jsx`: existing tests keep passing
  (confirm label unchanged). Update any query tied to the old dialog internals if needed.
  Add an assertion that the dialog shows the visible heading “Confirm account creation”
  and both footer buttons.

## Acceptance

`npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx src/shared/components/__tests__/ConfirmationModal.test.jsx`, then `npm test` and `npm run lint`, all passing.
