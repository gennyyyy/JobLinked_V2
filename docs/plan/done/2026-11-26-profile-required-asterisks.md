# Profile — red required asterisks on every required field

Status: approved by architect, ready for implementation
Date: 2026-11-26

## Confirmed brief

Every control on the job-seeker Profile page whose value is required to save
must show the red `*` marker already used by `TextField`. Optional fields must
not show it.

Scope decision: includes the Profile page's Personal, Address, Skills, and
Education add forms. Account-settings fields already use `TextField` and
already show the marker. Resume upload and profile photo stay optional.

## Findings

- `TextField` already renders
  `{props.required && <span className="text-destructive">*</span>}` inside
  `FieldLabel` (`src/shared/components/design.jsx:154-157`).
- `SelectField` does **not** render it (`design.jsx:166-184`).
- `Profile.jsx` required-by-validation controls and their current marker state:
  - Full Name, Contact Number, First Name, Last Name, Birthday, Street:
    `TextField required` → marker present.
  - Employment Status, City / Municipality, Province / State:
    `SelectField required` → marker missing because SelectField lacks support.
  - Barangay: required in `validate()` but no `required` prop → marker missing.
  - Your Skills: `TagField required` → marker present.
  - Education add form: Level, School are required to add; Graduation Year is
    required unless "Currently Studying Here" is checked → no props, no markers.
  - Optional, must remain unmarked: Middle Name, Suffix, Postal Code,
    Field / Course, Work Experience, Field (vocabulary picker).
- Only one other `SelectField` in the repo passes `required`
  (`CompanyProfile.jsx:390`, Industry). It correctly gains the marker; no tests
  query it.

## Changes

### 1. `src/shared/components/design.jsx`

Make `SelectField`'s label mirror `TextField`:

```jsx
<FieldLabel htmlFor={fieldId}>
  {label}
  {props.required && <span className="text-destructive">*</span>}
</FieldLabel>
```

No other SelectField behavior changes.

### 2. `src/features/job-seeker/Profile.jsx`

- Barangay `SelectField`: add `required`.
- Education `SelectField label="Level"`: add `required`.
- Education `TextField label="School"`: add `required`.
- Education `TextField label="Graduation Year"`: add
  `required={!eduForm.studying}` so the marker disappears while the year input
  is disabled by "Currently Studying Here".
- Leave all optional fields untouched.

### 3. Tests

Adding the marker changes the label text (`"Barangay"` → `"Barangay*"` in
`textContent`), which breaks exact `getByLabelText('…')` queries. Update these
files to regex/prefix matchers (`/^Barangay/`, `/^City \/ Municipality/`,
`/^Province \/ State/`, `/^Level/`, `/^School/`, `/^Graduation Year/`):

- `src/features/job-seeker/__tests__/Profile.address.test.jsx`
- `src/features/job-seeker/__tests__/Profile.barangay.test.jsx`
- `src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx`
- `src/features/job-seeker/__tests__/Profile.required.test.jsx`
- `src/features/job-seeker/__tests__/Profile.a11y.test.jsx`

Add one focused test (in `Profile.required.test.jsx` or a new
`Profile.asterisks.test.jsx`) that:

1. On Personal + Address: asserts the label element for Full Name, Contact
   Number, First Name, Last Name, Birthday, Employment Status, Street, Barangay,
   City, and Province contains a `span.text-destructive` whose text is `*`.
2. On Skills: asserts the `Your Skills` label contains `*`.
3. On Education: asserts Level, School, and Graduation Year each contain `*`.
4. Asserts the optional controls (Middle Name, Suffix, Postal Code,
   Field / Course, Work Experience) contain no `*`.
5. Toggles "Currently Studying Here" and asserts the Graduation Year marker
   disappears.

Helper shape:

```js
const labelOf = (name) => screen.getByLabelText(name).labels[0]
```

## Acceptance

- All required Profile controls display the red `*`; optional controls do not.
- Graduation Year shows it only when the year is actually required.
- `npm test` and `npm run lint` pass.

## Out of scope

- Registration form (already uses its own red markers).
- Other product pages' required markers beyond the shared SelectField fix.
- Validation logic, payloads, schema, or API.

## Handoff

Dispatch to `frontend`. Files: `design.jsx`, `Profile.jsx`, the five test files
above, plus the asterisk assertions.
