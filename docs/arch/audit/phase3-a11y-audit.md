# Phase 3 — WCAG 2.1 AA Accessibility Audit (JobLinked)

Scope: auth (Login, Register, JobSeekerRegister, EmployerRegister), job-seeker (Jobs, Profile),
employer (Applicants, JobPosts), super-admin (Dashboard, UserManagement), shared (PortalLayout,
ProtectedRoute, Toast) + modals they import (TermsModal, ConfirmationModal, LoadingScreen, TagInput).
Report only — no source files modified.

> Contrast ratios computed from theme tokens in `src/index.css` (`--color-primary` #123C63,
> `--color-accent` #B8860B, `--color-danger` #C62828, `--color-dark-blue` #0A2540) and Tailwind
> grays. **Normal text < 18px / < 14px bold needs 4.5:1; UI components/graphics need 3:1.**

## Findings

| File:line | Criterion | Sev | Fix (one line) |
|---|---|---|---|
| `employer/JobPosts.jsx:833,854,867,884,902,981,1007,1035,1063,1076,1160,1194,1225` | 1.3.1 / 3.3.2 | **Critical** | Every modal `<label>` lacks `htmlFor`/wrapping — add `htmlFor` + matching `id` (or wrap the control); entire job-post form is unlabelled for AT. |
| `job-seeker/Profile.jsx:423,427,431,435,439,443,450,474,481,485,494,518,519,523,531,550,554,556,557,522` | 1.3.1 / 3.3.2 | **Critical** | Same defect: labels are siblings, not associated — add `htmlFor`/`id` pairs on the edit form. |
| `job-seeker/Jobs.jsx:184`, `employer/Applicants.jsx:199,212`, `employer/JobPosts.jsx:564,586`, `super-admin/UserManagement.jsx:185` | 1.3.1 / 4.1.2 | **Critical** | Search/select controls use placeholder-only (no label) — add a visible or `sr-only` `<label>`. |
| `auth/JobSeekerRegister.jsx:478,480,481` | 1.3.1 / 4.1.2 | **Critical** | Education school / course / year inputs have placeholder only — add labels (`aria-label` at minimum). |
| `employer/JobPosts.jsx:619` | 2.1.1 | **Critical** | `<tr onClick>` opens the detail modal with no keyboard handler/`role`/`tabIndex` — move the click to a real `<button>` (delete the dead button at `:624`). |
| `shared/…/Toast.jsx` usage + `Login.jsx:74`, `EmployerRegister.jsx:345`, `JobSeekerRegister.jsx:523`, `job-seeker/Jobs.jsx:209-217`, `job-seeker/Profile.jsx:173,599`, `super-admin/Dashboard.jsx:25`, `UserManagement.jsx:46,161,166` | 4.1.3 | **Critical** | Submit/load/upload errors render as plain text — add `role="alert"` (or a live-region host) so failures are announced. |
| `Login.jsx:119`, `Register.jsx:79`, `EmployerRegister.jsx:137,219,357`, `JobSeekerRegister.jsx:337,361,417,504,535`, `Jobs.jsx:264,686`, `Profile.jsx:390,512,580,596,681,724,730`, `JobPosts.jsx:585,686`, `UserManagement.jsx:193,216,246,274` | 1.4.3 | **Critical** | `text-gray-400` (#9ca3af) on white = **2.5:1** — swap to `text-gray-500` (#6a7282, 4.8:1) or darker. |
| All audited files (`placeholder:text-gray-400`) | 1.4.3 | **Critical** | Placeholder text at 2.5:1 — use `placeholder:text-gray-500` (placeholders are text, not decoration). |
| `job-seeker/Profile.jsx:385` | 1.4.3 | **Critical** | `text-accent` (#B8860B, L 0.27) on `bg-accent/20` over white (L 0.37) = **1.3:1** — use `text-primary` or `bg-accent/40` with `text-dark-blue`. |
| `shared/PortalLayout.jsx:67` | 1.4.3 | High | `text-accent` on `bg-primary` = **3.5:1** at 10px — use `text-white` or `text-accent/90` on `bg-dark-blue` (4.8:1). |
| `employer/JobPosts.jsx:801`, `:1276`, `job-seeker/Jobs.jsx:328`, `super-admin/UserManagement.jsx:315`, `shared/PortalLayout.jsx:134`, `shared/ConfirmationModal.jsx` | 2.1.2 / 2.4.3 | High | No Escape-key close, no focus trap, no focus restore on any modal — add `keydown` Esc, cycle Tab inside, and return focus to the opener. |
| `job-seeker/Profile.jsx:413` | 4.1.2 | High | Progress bar `div` has no `role="progressbar"`/`aria-valuenow`/`aria-valuetext` — add the three attributes. |
| `shared/LoadingScreen.jsx` | 4.1.3 | High | Spinner block has no `role="status"`/`aria-live` — wrap with `role="status" aria-live="polite"`. |
| `employer/Applicants.jsx:368,392`, `employer/JobPosts.jsx:1179,1210` | 4.1.2 | High | Toggle chips (attire/bring/benefits/tags) don't expose state — add `aria-pressed={selected}`. |
| `shared/PortalLayout.jsx:39-51` | 2.4.3 / 4.1.2 | High | Mobile hamburger has `aria-label` but no `aria-expanded`/`aria-controls`; nav drawer isn't a `nav` landmark with a label and isn't closed on outside click/Esc. |
| `auth/Login.jsx:72`, `employer/Applicants.jsx:207-223`, `job-seeker/Jobs.jsx:171` | 3.3.1 / 3.3.3 | High | Field errors aren't tied to inputs — add `aria-invalid` + `aria-describedby` pointing at the error `<p>`; mark required via `aria-required` where `required` isn't used. |
| `auth/JobSeekerRegister.jsx:500` | 1.4.1 | High | The "agree to terms" checkbox is gated on reading (`disabled` + grey `opacity-70`) — disabled controls are unfocusable/unreadable; replace with `aria-disabled` and explain the block in the description. |
| All pages (`Login/Register/…`, `PortalLayout`) | 2.4.1 | High | No skip-to-content link — add an `sr-only focus:not-sr-only` anchor before `<main id="main">`. |
| `employer/JobPosts.jsx:775` | 1.3.1 | Medium | `<h3>` follows `<h1>` with no `<h2>` on the page — use `h2` (or promote the section titles). |
| `employer/JobPosts.jsx:905` | 4.1.2 | Medium | Barangay listbox lacks `aria-activedescendant` and roving `tabIndex`; the trigger button has no name tied to its label — add `aria-labelledby="…label-id"`. |
| `shared/ConfirmationModal.jsx:7` | 4.1.2 | Medium | `role="dialog"` has no `aria-labelledby`/`aria-describedby` — point at the message `<p>` (`aria-describedby`). |
| `employer/Applicants.jsx:237`, `employer/JobPosts.jsx:603`, `super-admin/UserManagement.jsx:205` | 1.3.1 | Medium | Data tables have no `scope="col"` on `<th>` and no `<caption>`/`aria-label` — add both. |
| `job-seeker/Profile.jsx:35,36` | 4.1.2 | Medium | "View"/"Download" resume links open a new tab with no warning — append `(opens in new tab)` to the link text. |
| Whole codebase | 2.3.4 / 1.4.10 | Medium | No `@media (prefers-reduced-motion: reduce)` and no reflow/200%-zoom testing — add a reduced-motion block disabling transitions/spinners. |
| `shared/PortalLayout.jsx:130` | 4.1.2 | Low | `<footer aria-hidden="true">` is a decorative spacer — use a `<div>` so it can't be mistaken for contentinfo. |

## Correct already — don't break these

- **Modals that got it right**: `TermsModal` has `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler, focus on the close button, and body scroll lock — the template for the other five dialogs.
- **`Toast.jsx`**: `role="status"` + `aria-live="polite"`, and its dismiss button has `aria-label="Dismiss"` — keep as-is.
- **`Applicants.jsx:327`** per-row action errors already use `role="alert"` — reuse this pattern for the page-level errors.
- **`JobSeekerRegister.jsx:339`** and **`Profile.jsx:600`** autofill/resume status use `role="status" aria-live="polite"` — good.
- **Required-field markers** in `JobSeekerRegister`/`EmployerRegister` are `aria-hidden="true"` so screen readers don't announce stray asterisks — copy that pattern.
- **All `<img>`** in scope carry `alt="JobLinked"` (Login, Register, both register forms, PortalLayout) — no empty/undescribed images found.
- **Focus styling**: every `focus:outline-none` in scope is paired with a `focus:ring-*` or a `focus:border-primary` change; the border-only variants still clear 3:1 against `gray-50`. Preserve this pairing when editing inputs.
- **Touch targets**: primary controls are `min-h-[44px]` (Login, both registers, Jobs, JobPosts) — keep the floor.
- **`TagInput`**: input has `aria-label` from the placeholder and each remove chip has `aria-label="Remove {tag}"` — correct.
- **`UserManagement.jsx:250`** uses an `sr-only` label naming the user for the per-row role select — the right pattern for the other unlabelled selects.
- **`ProtectedRoute.jsx`** renders only a redirect/loading state — no a11y surface of its own; nothing to change.

## Verification status

Static review of the files listed above only. Ratios are computed, not measured in a browser. Not verified:
assistive-technology output (NVDA/VoiceOver), real keyboard runs, 200% zoom reflow, and axe/WAVE sweeps.
`Accreditation.jsx`, `AuthCallback.jsx`, `AuthProvider.jsx` were excluded per scope (another agent is editing them).
