# Employer + PESO admin — required markers and enforcement

Status: approved by architect, ready for implementation
Date: 2026-11-26

## Confirmed brief

Make required markers truthful on every role's profile form, matching the
job-seeker profile work:

- **Employer (Company Profile):** add the missing red `*` markers, remove the
  false marker, and enforce the same requirements the employer registration
  form imposes.
- **PESO admin (Profile):** the Full Name marker already exists; enforce a
  non-empty name so the marker is truthful.

No schema or API changes.

## Employer — `src/features/employer/CompanyProfile.jsx`

### Markers

Add `required` to:

- Barangay / District `SelectField`
- City / Municipality `SelectField`
- Province / State `SelectField`
- Representative First Name, Last Name, Designation / Position,
  Representative Mobile, Representative Email `TextField`s.

Use a set for the representative loop:

```js
const REQUIRED_REPRESENTATIVE_FIELDS = new Set([
  "first_name", "last_name", "representative_position",
  "representative_phone", "representative_email",
]);
```

Remove `required` from **About the Company** — neither registration nor the
current validation requires it.

Leave unmarked (optional): House / Building / Unit No., Subdivision / Village /
Building, Postal Code, Middle Name, Suffix, Website.

### Enforcement in `validate()`

Keep the existing phone-format checks and add, using `form` keys:

| Key | Rule | Message |
|---|---|---|
| `name` | non-empty | `Company name is required` |
| `industry` | non-empty | `Industry is required` |
| `company_email` | non-empty + email regex | `Company email is required` / `Invalid email address` |
| `phone` | non-empty | `Contact number is required` |
| `street_address` | non-empty | `Street address is required` |
| `barangay_district` | non-empty | `Barangay / District is required` |
| `city_municipality` | non-empty | `City / Municipality is required` |
| `province_state` | non-empty | `Province is required` |
| `postal_code` | empty or 4 digits | `Postal code must be 4 digits` |
| `first_name` | non-empty | `First name is required` |
| `last_name` | non-empty | `Last name is required` |
| `representative_position` | non-empty | `Position is required` |
| `representative_phone` | non-empty | `Representative mobile is required` |
| `representative_email` | non-empty + email regex | `Representative email is required` / `Invalid email address` |

Keep `PHONE_ERROR` for a filled-but-invalid phone/mobile. Phone fields are no
longer optional on this form (registration requires the contact number), so
remove the current "blank stays blank" assumption in `validate()` and its
comment.

### Error display and tab routing

- Pass `error={errors[name]}` in the `COMPANY_FIELDS`, `ADDRESS_FIELDS`,
  `REPRESENTATIVE_FIELDS` loops.
- Add `error` to the Industry, Barangay / District, City / Municipality,
  Province / State selects and the Postal Code field.
- After `setErrors(next)`, route to the owning tab when invalid:
  - `name` / `industry` → `company`
  - `company_email` / `phone` / address / `postal_code` → `contact`
  - representative keys → `representative`

`field(name)` already clears a field's error on change; no change needed there.

## PESO admin — `src/features/super-admin/Profile.jsx`

- Add `nameError` state.
- In `handleSubmit`, before saving: if `!name.trim()`, set
  `nameError = 'Enter your full name.'` and return without calling
  `updateProfile`.
- Pass `error={nameError}` to the Full Name `TextField`; clear it on change.

## Tests

### `src/features/employer/__tests__/CompanyProfile.address.test.jsx`

- Add a `COMPLETE_COMPANY` fixture with every required key:
  `company_name: 'Santa Maria Trading'`, `industry`, `company_email` (valid),
  `phone` (valid), `street_address`, `barangay_district`,
  `city_municipality`, `province_state`, plus representative `first_name`,
  `last_name`, `representative_position`, `representative_phone`,
  `representative_email`. Use it for every test that expects a successful save.
- Isolate the invalid-phone cases: build from `COMPLETE_COMPANY` and break only
  the phone under test, so tab routing keeps that error visible.
- Replace `saves with blank phone fields` with a test asserting the save is
  blocked and `Contact number is required` / `Representative mobile is
  required` appear.
- Update exact label queries that gain `*`:
  `/^City \/ Municipality/`, `/^Province \/ State/`,
  `/^Representative Mobile/`.

### `src/features/employer/__tests__/CompanyProfile.barangay.test.jsx`

- Update `getByLabelText('Barangay / District')` to
  `/^Barangay \/ District/`.

### New `src/features/employer/__tests__/CompanyProfile.required.test.jsx`

1. Markers: required controls contain a `span.text-destructive` with `*`
   (Company Name, Industry, Recruitment Contact Email, Business Phone, Street
   Address, Barangay / District, City / Municipality, Province / State,
   Representative First/Last Name, Position, Mobile, Email); optional controls
   do not (About the Company, House / Unit, Subdivision, Postal Code, Middle
   Name, Suffix, Website).
2. A minimal profile (company name only) blocks save, shows errors, and routes
   to the owning tab; `updateProfile` is not called.
3. `COMPLETE_COMPANY` saves successfully.

Use the mock pattern from `CompanyProfile.address.test.jsx`.

### `src/features/super-admin/__tests__/Profile.email.test.jsx`

- Add: clearing Full Name and saving shows `Enter your full name.` and does not
  call `updateProfile`.

## Acceptance

- Every required employer/admin profile control shows the red `*`; optional
  controls do not.
- Employer profile cannot save without the same core fields registration
  requires; errors appear on the correct tab.
- PESO admin cannot save an empty Full Name.
- `npm test` and `npm run lint` pass.

## Out of scope

- Server-side validation, schema, or API changes.
- Employer registration changes.
- Job-seeker profile (already done).
- Enforcing postal format on any other form.

## Risk

Legacy employer profiles missing required data (including blank business phone
or representative details) cannot save until completed. This is the intended
parity policy.

## Handoff

Dispatch to `frontend`. Files: `CompanyProfile.jsx`, `super-admin/Profile.jsx`,
the two existing employer test files, the new required-marker test, and the
super-admin profile test.
