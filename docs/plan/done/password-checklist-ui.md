# Visible password rules checklist on both registration pages

Status: confirmed brief, ready for implementation
Owner: frontend
Confirmed by user: yes (visible checklist with live pass/fail ticks)
Amends: `docs/plan/done/password-symbol-requirement.md`

## What

Under the Password field on both registration pages, always show the four
rules with live state while typing:

- At least 8 characters
- One letter
- One number
- One symbol (e.g. ! @ # $)

Met rules use the success token + check glyph; unmet rules stay muted with a
circle glyph, so state is not colour-only. Submit-time validation stays
exactly as is (`passwordError`).

## How

1. `src/shared/utils/password.js`: export `PASSWORD_RULES` — array of
   `{ id, label, test }` using the same regexes as `passwordError`:
   length ≥ 8, `/[a-z]/i`, `/[0-9]/`, `/[^a-z0-9\s]/i`. Do not change
   `passwordError`, its messages, or the constants. The 72-char maximum stays
   a submit-time error only; it is not a live requirement.
2. New `src/shared/components/PasswordRequirements.jsx`:
   - props: `value = ''`
   - `<ul aria-label="Password requirements">`, one `<li>` per rule
   - each item: aria-hidden glyph (lucide `Check` / `Circle`, size ~3.5),
     an `sr-only` "Met: " / "Not met: " prefix, then the label
   - met → success colour, unmet → muted
   - no `aria-live` (avoids announcing on every keystroke); the sr-only state
     is read when the list is navigated
3. Mount it directly under the password input on both pages:
   - `src/features/auth/JobSeekerPersonalStep.jsx` — `<PasswordRequirements value={form.password} />`
   - `src/features/auth/EmployerCompanyStep.jsx` — the form is uncontrolled
     (FormData in `EmployerRegister.jsx`). Make **only** the password input
     controlled with local `useState`, keep `name="password"` so FormData still
     submits it, and render `<PasswordRequirements value={password} />`.
     Keep the existing error-clearing onChange behaviour and the confirm field
     unchanged.

## Tests

- `src/shared/components/__tests__/PasswordRequirements.test.jsx`: renders the
  four labels; all unmet for `''`; all met for `password123!`; mixed state for
  `password` (length met, number and symbol unmet).
- `src/shared/utils/__tests__/password.test.js`: add a consistency case — for
  `password123!`, `Passw0rd!`, `password123`, `'!@#$%^&*'`, `''`, every
  `PASSWORD_RULES.test` passes exactly when `passwordError` returns `''`
  (values ≤ 72 chars).
- One registration-page assertion (job-seeker or employer suite) that the
  checklist labels render on the password field.

## Acceptance

- Focused Vitest over the two registration suites + the new component test +
  password util passes.
- `npm run lint` clean.
- Pre-existing `EmployerRegister`/`TermsModal` failures stay untouched.

## Out of scope

Server, database, Supabase, strength meter, password history, changes to
submit-time messages.
