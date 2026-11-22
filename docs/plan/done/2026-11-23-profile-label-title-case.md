# Title Case for all profile form labels

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** every form field label on the three profile pages uses Title Case
  (capitalize major words; keep short joining words such as or/of/and/the/to
  lowercase unless first). Page headlines, descriptions, buttons, tab labels,
  panel titles, and body copy stay as they are.
- **Why:** the login-email rename exposed that profile field labels are sentence
  case; make them consistent.
- **Done when:** the labels below are title-cased, exact-label tests are updated,
  and `npm test`/`npm run lint` pass.
- **Out of scope:** registration pages, buttons/tabs/headings, sentences/consent
  copy, validation messages, page titles.

## Exact label changes

Job seeker Profile (`src/features/job-seeker/Profile.jsx`):

- Profile picture → Profile Picture
- Full name → Full Name
- Contact number → Contact Number
- Professional headline → Professional Headline
- Street or local address → Street or Local Address
- Your skills → Your Skills
- Work experience → Work Experience
- Graduation year → Graduation Year
- Education status → Education Status (short data label)
- Currently studying here → Currently Studying Here (checkbox)
- Leave already-correct/single-word labels unchanged.

Job seeker ResumeAutofill (`src/features/job-seeker/ResumeAutofill.jsx`):

- LABELS: Full name → Full Name; Contact number → Contact Number; Professional
  headline → Professional Headline; Street address → Street Address; Work
  experience → Work Experience.
- ResumePicker label: Choose a resume to autofill → Choose a Resume to Autofill.
- Leave the consent sentence, help/status copy, and the “Optional” hint.

Employer CompanyProfile (`src/features/employer/CompanyProfile.jsx`):

- Company name → Company Name
- Recruitment contact email → Recruitment Contact Email
- Business phone → Business Phone
- Street address → Street Address
- Representative mobile → Representative Mobile
- About the company → About the Company
- Website (optional) → Website (Optional)
- Company logo → Company Logo (file-input label)
- Leave already-correct labels and aria-labels/alt text.

Super-admin Profile (`src/features/super-admin/Profile.jsx`):

- Full name → Full Name
- Email address → Email Address

Shared components rendered by the profiles:

- `ChangePassword.jsx`: Current password → Current Password; New password →
  New Password; Confirm new password → Confirm New Password. Keep the
  `Login Email (read only)` hint lowercase and the panel title `Credentials`.
- `AccountSettings.jsx`: Application & recruitment updates → Application &
  Recruitment Updates; Community announcements → Community Announcements.
  (Used by the settings page too; same labels apply.)
- `MfaPanel.jsx`: Current password → Current Password (both occurrences);
  Verification code → Verification Code. Panel title and copy unchanged.
- Do not touch PasswordRequirements rule text.

## Tests to update (exact-label lookups)

- `Profile.a11y.test.jsx`: 'Profile picture' → 'Profile Picture',
  'Work experience' → 'Work Experience', 'Choose a resume to autofill' →
  'Choose a Resume to Autofill'.
- `ProfileResumeUpload.test.jsx` and `ProfileResumeAutofill.test.jsx`:
  'Choose a resume to autofill' → 'Choose a Resume to Autofill';
  preview 'Full name' → 'Full Name'.
- `CompanyProfile.address.test.jsx`: 'Representative mobile' →
  'Representative Mobile' (all three occurrences).
- `Profile.address.test.jsx`: 'Graduation year' → 'Graduation Year'.

## Acceptance

Run the affected profile/shared suites, then `npm test` and `npm run lint`, all
passing. Report commands and counts.
