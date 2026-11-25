# Profile required fields — parity with job-seeker registration

Status: approved by architect, ready for implementation
Date: 2026-11-25

## Confirmed brief

Align the job-seeker **Profile** form so it requires every field job-seeker
registration requires, excluding fields that cannot be re-collected on Profile
(email, password, one-time terms/accuracy consent).

Chosen policy: **Profile adopts signup's required set.** Profile's existing
skills and education completeness gates stay as intentional
profile-completion requirements.

Sources:
- Registration validation: `src/features/auth/jobSeekerRegistration.js:35-58`
- Profile validation: `src/features/job-seeker/Profile.jsx:299-318`
- Profile form fields: `Profile.jsx:595-627`, `638-647`, `662-671`

## Exact behavior changes

File: `src/features/job-seeker/Profile.jsx`

### `validate()`

Replace the unconditional full-name check with the two name modes the save
already uses (`handleSubmit` computes the same condition at
`Profile.jsx:342`):

- If any of `firstName`, `middleName`, `lastName`, `suffix` is non-empty:
  - first name required → `'Enter your first name.'`
  - last name required → `'Enter your last name.'`
- Otherwise: full name must stay 3+ characters → existing
  `'Enter your full name.'`

Add, in the same style as the existing messages:

- birthday required → `'Enter your birthday.'`
- employment status required → `'Choose your employment status.'`
- city / municipality required → `'Choose your city / municipality.'`
- province required → `'Choose your province.'`
- postal code, when non-empty, must match `/^\d{4}$/` →
  `'Postal code must be 4 digits.'` (same rule and message as registration,
  `jobSeekerRegistration.js:48`)

Keep unchanged: phone, barangay, street address (5+ chars), education
(at least one entry unless still loading/failed), skills (at least one).

### Error-driven tab routing

Extend the existing `setTab(...)` ternary so the first invalid field lands on
its owning tab:

- personal: name / firstName / lastName / phone / birthdate / employmentStatus
- address: barangay / address / cityMunicipality / provinceState / postalCode
- skills: skills
- education: education

### Field rendering

Pass the new errors so they are visible, and add `required` attributes for
semantics (the form is `noValidate`, so validation remains the gate):

- First Name: `required`, `error={errors.firstName}`
- Last Name: `required`, `error={errors.lastName}`
- Birthday: `required`, `error={errors.birthdate}`, plus
  `max={new Date().toISOString().slice(0, 10)}` to match the signup input
- Employment Status: `required`, `error={errors.employmentStatus}`
- City / Municipality: `required`, `error={errors.cityMunicipality}`
- Province / State: `required`, `error={errors.provinceState}`
- Postal Code: `error={errors.postalCode}`

Do not change the employment-status option list in this task.

## Tests

Update fixtures that submit the form so they represent a valid signup-complete
profile. Add these fields to `STORED` in:

- `src/features/job-seeker/__tests__/Profile.address.test.jsx`
- `src/features/job-seeker/__tests__/Profile.skills.test.jsx`

```js
birthdate: '1998-05-04',
employment_status: 'Employed',
city_municipality: 'Santa Maria',
province_state: 'Bulacan',
postal_code: '3022',
```

Add `src/features/job-seeker/__tests__/Profile.required.test.jsx` covering:

1. Missing birthday + employment status → save is blocked, both inline messages
   appear, `updateProfile` is not called, and the Personal tab is active.
2. Missing city + province and a malformed postal code → save is blocked, all
   three messages appear, and the Address tab is active.
3. Component-name mode with Last Name cleared → `'Enter your last name.'`, save
   blocked.
4. A full-name-only user (no first/last/suffix) with a 3+ character full name
   still saves (no regression for legacy profiles).

Use the existing mock pattern from `Profile.address.test.jsx`; include
`listEmployment` in the seekers mock.

Check any other test that mounts `Profile` and submits; run the whole suite.

## Acceptance

- A profile missing any field required at signup cannot be saved and shows the
  inline message on the correct tab.
- A complete profile saves exactly as before (same payload).
- Skills and education gates are unchanged.
- `npm test` and `npm run lint` pass.

## Out of scope

- Server-side validation or schema changes.
- Registration changes.
- Replacing the hardcoded employment-status options with the constant.
- Any change to the Work Experience / Employment through JobLinked panels.

## Risk

Legacy profiles stored without birthday, employment status, city, or province
will be unable to save until those fields are completed. That is the intended
parity policy; the inline errors make the required fields explicit.

## Handoff

Dispatch to `frontend`. Files: `Profile.jsx` plus the test fixtures and the new
required-fields test. No backend or database work.
