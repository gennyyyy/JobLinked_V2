# Make the job-seeker graduation year clear

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** the graduation year is vague in two places; make both explicit.
- **Registration (`JobSeekerBackgroundStep`):** the year input currently shows only the
  placeholder “Year”. Give it a visible **Graduation Year** label (htmlFor wired) and the
  placeholder **e.g. 2024**; keep the existing `aria-label` and `inputMode="numeric"`.
  Align the row so the course input and the labelled year column share a baseline
  (`items-end`).
- **Profile (`Profile.jsx`, education list):** entries currently render a bare year
  (“Business · 2022”). Render **Graduated 2022** instead; keep **Currently studying** for
  `end_year === null` and keep the field name when present.
- **Done when:** the registration field is self-explanatory before typing, profile rows
  state what the year means, tests/lint pass.
- **Out of scope:** validation rules, date formatting elsewhere, server/API, other forms.

## Changes

- `src/features/auth/JobSeekerBackgroundStep.jsx` — wrap the year input in a small column
  with `<Label htmlFor="education-year">Graduation Year</Label>`; give the input
  `id="education-year"`, `placeholder="e.g. 2024"`, keep `aria-label="Graduation year"`;
  change the flex row to `items-end`.
- `src/features/job-seeker/Profile.jsx` — build the meta line as
  `[field, end_year ? `Graduated ${end_year}` : 'Currently studying'].filter(Boolean).join(' · ')`
  (currently studying only when `end_year === null`; omit when the value is undefined).

## Tests

- `src/features/auth/__tests__/JobSeekerRegister.test.jsx`: replace
  `getByPlaceholderText('Year')` queries with the labelled control
  (`getByLabelText(/graduation year/i)`), including the disabled-under-currently-studying
  assertion. Keep all other assertions.
- `src/features/job-seeker/__tests__/Profile.address.test.jsx`: add an assertion that the
  education list shows `Graduated 2022` for the seeded record.

## Acceptance

Focused runs for both suites, then `npm test` and `npm run lint`, all passing.
