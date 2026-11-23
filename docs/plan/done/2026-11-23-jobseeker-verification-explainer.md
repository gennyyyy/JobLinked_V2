# Explain verification on the job-seeker registration form

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** on the final step of the job-seeker registration form, explain in the UI
  what “verified” means and what happens after Create Account.
- **How:** a compact info panel rendered only on the last step, above the action buttons:
  three short points plus one clarifying line that verification is email ownership only,
  not PESO accreditation.
- **Done when:** the panel appears on the review step (and not on earlier steps), the
  copy is accurate, and tests/lint pass.
- **Out of scope:** the success screen, employer registration, backend changes, styling
  outside the panel.

## Copy

Heading: **What happens after you create your account**

1. We email a verification link to the address you entered.
2. Your account activates only after you open that link and sign in — the link expires
   in 1 hour.
3. The details you entered are saved and applied to your profile automatically.

Closing line: **“Verified” means we confirmed the email belongs to you. Job seekers do
not need PESO accreditation.**

## Changes (`src/features/auth/JobSeekerRegister.jsx`)

- Inside the `step === TOTAL_STEPS - 1` block (after the captcha widget), render:

```jsx
<section
  aria-labelledby="create-account-explainer"
  className="rounded-xl border border-border bg-muted/60 p-4 text-xs leading-6 text-muted-foreground"
>
  <h2 id="create-account-explainer" className="text-sm font-semibold text-dark-blue">
    What happens after you create your account
  </h2>
  <ol className="mt-2 list-decimal space-y-1 pl-4">
    <li>We email a verification link to the address you entered.</li>
    <li>Your account activates only after you open that link and sign in — the link expires in 1 hour.</li>
    <li>The details you entered are saved and applied to your profile automatically.</li>
  </ol>
  <p className="mt-2">
    <strong className="font-semibold text-dark-blue">“Verified”</strong> means we confirmed
    the email belongs to you. Job seekers do not need PESO accreditation.
  </p>
</section>
```

- No other markup, validation, submit flow, or copy changes. Leave the existing stray
  `console.log` alone (out of scope).

## Tests (`src/features/auth/__tests__/JobSeekerRegister.test.jsx`)

- New test: on step 1 the explainer is absent; after `fillRequired()` (which lands on the
  final step) the heading “What happens after you create your account” is visible, along
  with the email-verification point and the “not PESO accreditation” line.
- Existing tests stay unchanged and passing.

## Acceptance

`npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx`, then `npm test`
and `npm run lint`, all passing. Report counts.
