# Standard labeled fields across job-seeker step 3

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** apply the Graduation Year field's labeled-container pattern to every field in
  step 3 (Background & Consent) of the job-seeker registration form.
- **How:** in `JobSeekerBackgroundStep.jsx`, wrap Education Level, School Name, and
  Course / Field each in a container with the same visible
  `<Label className="mb-1 text-xs text-muted-foreground">` used by Graduation Year. Keep
  the existing placeholders, `aria-label`s, classes, and the Field/Skills pickers (already
  labelled) unchanged.
- **Standard:** label above control, `htmlFor` wired to the control id, label classes
  `mb-1 text-xs text-muted-foreground`; grid rows use `items-end` for mixed label/control
  alignment.
- **Done when:** all education controls show a visible label; layout stays tidy at mobile
  and desktop widths; tests/lint pass.
- **Out of scope:** steps 1–2, validation, values, other forms, picker components.

## Changes (`src/features/auth/JobSeekerBackgroundStep.jsx`)

- Education Level: container with `<Label htmlFor="education-level">Education Level</Label>`;
  `FormSelect` gets `id="education-level"` (keep its `aria-label` and classes).
- School Name: container with `<Label htmlFor="education-school">School Name</Label>`;
  `Input` gets `id="education-school"` (keep `aria-label="School name"` and placeholder).
- Course / Field: container with
  `<Label htmlFor="education-field">Course / Field <span className="text-muted-foreground">(optional)</span></Label>`;
  `Input` gets `id="education-field"` (keep `aria-label="Course / field of study"` and
  placeholder). Row becomes `grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-end` with the
  Graduation Year column unchanged.
- Keep the “Currently studying here” checkbox, error text, Field/Skills pickers, and
  consent blocks as they are.

## Tests (`src/features/auth/__tests__/JobSeekerRegister.test.jsx`)

- Add one assertion that the education section exposes visible labels
  “Education Level”, “School Name”, “Course / Field”, and “Graduation Year”.
- Existing queries (`/education level/i`, `getByLabelText(/graduation year/i)`,
  placeholders) must keep passing.

## Acceptance

`npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx`, then `npm test`
and `npm run lint`, all passing.
