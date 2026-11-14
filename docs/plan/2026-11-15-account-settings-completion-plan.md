# Account Settings Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every verified gap in the account/system settings experience — persistence, email change, sessions, MFA, deactivation, reference-data editing, permission-aware UI, and accessibility — across all three roles.

**Architecture:** Extend the existing Express API and `AccountSettings`/`Settings` front-end. One additive Postgres table (`user_preferences`) plus one reference-data PATCH route carry the new state; everything else reuses Supabase Auth (email change, TOTP MFA, global sign-out) and the existing role tables. All admin endpoints keep the `auth → requireRole → requirePermission → audit` convention.

**Tech Stack:** Node 24, Express 4, pg 8, Supabase JS 2 (Auth/MFA), React 19, Vite, Vitest 4, RTL/jsdom.

**Spec:** this document. Re-audit evidence is inline (file:line). Related prior plans: `2026-11-15-super-admin-lacking-features.md` (different gaps; its reference-data task has already shipped) and ADR-042 (permission bundles already enforced server-side).

## Global Constraints

- **Schema:** changes go through `db/schema.sql` only (applied with `psql`, per repo rule), additive and idempotent (`create table if not exists`); no destructive DDL. The Lead Architect signs off on the DDL below with this plan.
- **Auth rule:** Supabase is identity only; all data reads/writes go through the Express API. No browser-side database calls.
- **Server routes:** `auth` + `requireRole`/ownership; admin routes add the matching `requirePermission`; every mutation writes `audit(...)`.
- **No new dependencies.** Supabase JS already exposes `updateUser`, `mfa.*`, and `signOut({ scope: 'global' })`.
- **Backward behavior:** preferences default to `true`; notifications behave identically until a user opts out; email sync is idempotent; deactivation is reversible by an admin; reference-data PATCH is additive.
- **Tests:** server tests in `server/src/routes/*.test.js`; client tests in `src/**/__tests__/`; run `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build` before each commit.
- **No UI regression:** existing settings layout (26 rem / 34 rem cards, scrollable bodies, categorized sections) keeps working.

## Re-Audit Corrections (2026-11-15, current HEAD)

| # | Original claim | Verdict after re-check |
|---|---|---|
| F8 | "Settings isn't in the navigation" | **RETRACTED.** `src/shared/constants.js:60` has `{ label: 'System settings', path: '/super-admin/settings' }` in the super-admin nav. The account dropdown's "Account settings" goes to Profile — that is a naming/linking nuance, not a missing entry. |
| F2 | "Email can't be changed" | **Confirmed, scoped.** Only the super-admin Profile shows an editable email field (`Profile.jsx:49`) that is never submitted (`Profile.jsx:23-25`) and is stripped server-side (`admin-users.js:164`). Employer/seeker login email is read-only by design (`CompanyProfile.jsx:147-150`; `profiles.js` EDITABLE sets exclude `email`). |
| F1 | "Preferences don't persist" | **Confirmed.** No `preferences` table (`db/schema.sql` tables: 26–547), no service/route; switches are local state (`AccountSettings.jsx:35-60`) and the tests assert the session-only message (`Profile.address.test.jsx:172-173`). |
| F3 | "No self-service session revocation" | **Confirmed.** Only the admin route `POST /admin/users/:id/sign-out` (`admin-users.js:329`); no self route. |
| F4 | "Password settings on Profile only" | **Confirmed.** `super-admin/Profile.jsx:75`; settings page has no security section. |
| F5 | "No MFA" | **Confirmed.** Zero `mfa|2fa|totp` references in `src/` or `server/`. |
| F6 | "No self-service deactivation/deletion" | **Confirmed.** Deactivation exists only as admin status changes (`admin-users.js` PATCH). |
| F7 | "Reference data can't be edited/reordered" | **Confirmed.** `admin-reference.js` has GET/POST/DELETE for reference rows; no PATCH; `sort_order` is stored but never sent by the UI. |
| F9 | "No permission-aware UI" | **Confirmed.** Server attaches `permissions` (ADR-042); `/auth/me` returns profile+role only (`auth.js:170-183`); `AuthProvider` exposes `role` only. Custom roles without `settings.manage` get raw 403s. |
| F10 | "Stale search entry" | **Confirmed.** `workspaceSearch.js:26` still points at the removed "Account overview" card; no entries for reference data. |
| U1–U4, A1–A3 | UX/a11y gaps | **Confirmed** in code (details in tasks). |

## Decisions (defaults; change before execution if desired)

1. **Preferences storage:** one row per auth user in `user_preferences`, columns for the two existing switches. Notification gating applies to `notifyUser` (user-facing) only; `notifyAdmins` stays ungated.
2. **Email change:** Supabase confirmation flow (`auth.updateUser({ email })`), role-table email synced idempotently on the next `/auth/me` when the token email differs. The super-admin email field becomes read-only with a "Change email" action in Security.
3. **Session revocation:** self-service "Sign out all devices" calls a new `POST /account/sessions/revoke-all` (GoTrue admin logout for the caller, service role) plus client `signOut({ scope: 'global' })`. No device list (requires GoTrue admin listing; not worth it).
4. **MFA:** optional TOTP enrollment for every role; **required for super-admin** via server-side `aal2` enforcement on `/admin/*` when the account has a verified factor. Login gains an AAL2 challenge step.
5. **Deactivation:** self-service "Deactivate my account" sets the caller's role-row `status = 'inactive'`, revokes sessions, then signs out. The last active full super-admin cannot deactivate (409 `LAST_ADMIN`). Admin reactivation uses the existing PATCH.
6. **Reference data:** rename + reorder only; categories stay `employment_type` and `education_level`; no new categories.
7. **Permissions in the client:** `/auth/me` returns `permissions` (`null` = full admin, array = custom bundle, `[]` = non-admin) and `custom_role_id`; the nav and settings page use it to hide/disable actions; the API remains the authority.

## API Contracts (new/changed)

| Method & path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET /account/preferences` | token | — | `200 { application_updates, community_announcements }` (defaults `true` when no row) | 401 |
| `PATCH /account/preferences` | token | `{ application_updates?: boolean, community_announcements?: boolean }` (≥1 key, strict booleans) | `200` merged object | `400 INVALID_PREFERENCES`; 401 |
| `POST /account/sessions/revoke-all` | token | — | `200 { revoked: true }` | `502 UPSTREAM_ERROR`; 401 |
| `POST /account/deactivate` | token | `{ confirm: "DEACTIVATE" }` | `200 { deactivated: true }` | `400 CONFIRM_REQUIRED`; `409 LAST_ADMIN`; 401 |
| `PATCH /admin/reference/:id` | admin + `settings.manage` | `{ value?: string, sort_order?: integer }` (≥1; value trimmed 1–80 chars; rejection of `custom_role`) | `200` updated row | `400 BAD_REQUEST`; `404 NOT_FOUND`; `409 CONFLICT` (duplicate); 403 |
| `GET /auth/me` (changed) | token | — | adds `permissions: string[] \| null`, `custom_role_id: number \| null`, `aal: 'aal1' \| 'aal2'` | unchanged |

Email change uses Supabase directly (no new route); `/auth/me` performs the role-table sync.

## Database Schema (approved with this plan)

Append to `db/schema.sql`:

```sql
-- Per-user notification preferences (additive; defaults preserve current behavior).
create table if not exists public.user_preferences (
  user_id                  uuid        primary key,
  application_updates      boolean     not null default true,
  community_announcements  boolean     not null default true,
  updated_at               timestamptz not null default now()
);
```

Migration plan: append only; run `psql "$DATABASE_URL" -f db/schema.sql` in each environment; the statement is idempotent. Rollback: `drop table public.user_preferences` (no other object references it).

## State & UI Strategy

- `AccountSettings` loads preferences on mount (`GET`), shows a skeleton/disabled state, tracks dirty values, saves via `PATCH`, and announces success with `role="status"`.
- A new shared **Security** panel (email change, password, sign-out-all, deactivate) is rendered in the settings page and in the embedded profile layouts; `ChangePassword` is reused, not rewritten.
- Permission-aware rendering is one helper: `hasPermission(user, key)` (null = all). Nav items, settings actions, and reference controls use it; the API still enforces.
- Scrollable card bodies get `tabIndex={0}`, `role="region"`, and an `aria-label`; sections get `aria-labelledby`; all save confirmations become `role="status"`.

## Review Focus

1. **Notification gating must never drop operational notices.** Unknown/future `type` values default to delivered; only the four mapped types honor `application_updates`, and only `system` honors `community_announcements`.
2. **Email sync races.** Two tabs converging must be idempotent; the sync writes only the caller's role row and audits once per actual change.
3. **MFA enforcement is server-side.** Client AAL checks alone are bypassable; `/admin/*` must reject `aal1` tokens for accounts with a verified factor.
4. **Deactivation lockout.** The last full super-admin cannot deactivate; a tagged admin cannot deactivate a full admin’s account; the caller’s own elevated permissions are unaffected otherwise.
5. **Backward behavior.** Existing tests (jobs, applications, notifications, profiles) must pass without preference rows; defaults keep every notification delivered.

---

## Phase 0 — Corrections & polish (no schema)

### Task 0.1: Search index — remove the dead entry, add the real ones

**Files:** Modify `src/shared/lib/workspaceSearch.js`
**Interfaces:** entries `{ title, path, sectionId, keywords, roles }` (existing shape).
- Delete the `Account overview` entry (`:26`).
- Add: `Reference data` (`/super-admin/settings`, `sectionId: 'reference-data'`), `Employment types` and `Education levels` (both `/super-admin/settings`, `sectionId` values used by the cards — add `id` attributes to those section elements if missing), `Security` (`/super-admin/settings`, `sectionId: 'security'`), `Notifications` keywords extended with `preferences`.
- Test: `src/shared/lib/__tests__/workspaceSearch.test.jsx` — assert every indexed `sectionId` exists in the corresponding page’s rendered DOM (or, minimally, that the dead `account-overview` entry is gone and the new entries are present for `super-admin`).

### Task 0.2: Accessibility polish on the settings page

**Files:** `src/shared/components/AccountSettings.jsx`, `src/features/super-admin/Settings.jsx`, `src/shared/components/design.jsx` (Panel if needed)
- Give each scrollable `contentClassName` region `tabIndex={0}`, `role="region"`, and `aria-label={`${title} content`}`. The `Panel` component accepts `contentProps` or a fixed `aria-label` derived from `title`.
- Wrap each settings section in `<section aria-labelledby="…">` with matching `id` on the `h2`.
- Change the save confirmation in `AccountSettings` to `<p role="status" className=…>`; keep errors `role="alert"`.
- Tests: Settings test asserts `getByRole('region', { name: /content/ })` for the scroll areas, `screen.getByRole('status')` after saving, and that each `h2` is referenced by its section’s `aria-labelledby`.

---

## Phase 1 — Preferences persistence (F1, U1)

### Task 1.1: `user_preferences` schema

**Files:** Modify `db/schema.sql`; create `db/migrations/2026-11-15-user-preferences.sql` only if the repo’s migration convention requires a file (check `schema_migrations` usage).
- Append the DDL from the section above.
- Verify: `psql "$DATABASE_URL" -f db/schema.sql` twice (idempotent); `\d public.user_preferences`.

### Task 1.2: Preferences API

**Files:** Create `server/src/routes/account.js`; register in `server/src/app.js`; Create `server/src/routes/account.preferences.test.js`
- `GET /account/preferences` → `select coalesce(p.application_updates, true), coalesce(p.community_announcements, true) from (values ($1::uuid)) v(id) left join public.user_preferences p on p.user_id = v.id` (or select-then-defaults).
- `PATCH /account/preferences` → validate at least one strict boolean key, upsert (`insert … on conflict (user_id) do update`), audit `account.preferences.update`, return merged row.
- Tests: defaults when no row; partial update preserves the other key; invalid types → 400; audit written once.

### Task 1.3: Server-side notification gating

**Files:** `server/src/util.js` (`notifyUser`), `server/src/routes/admin.js` (broadcast at `:227`); tests `server/src/__tests__/notifications.preferences.test.js`
- Mapping: `application | job | accreditation | document` → `application_updates`; `system` → `community_announcements`; anything else → delivered.
- `notifyUser`: fetch the preference once per call (`left join`); return early (still best-effort, no throw) when opted out.
- Broadcast: add `left join public.user_preferences p on p.user_id = u.id` and `where coalesce(p.community_announcements, true)` inside the insert-select.
- Tests: each mapped type suppressed when its pref is false; unknown type always delivered; broadcast excludes opted-out users; `notifyAdmins` unchanged.

### Task 1.4: Preferences UI (shared for all roles)

**Files:** `src/shared/components/AccountSettings.jsx`, `src/shared/services/account.js` (new), tests `src/shared/components/__tests__/AccountSettings.preferences.test.jsx`
- Service: `getPreferences()`, `updatePreferences(patch)` via `api`.
- UI: load on mount (skeleton while loading), switches bound to loaded values, dirty tracking, Save disabled until dirty, `role="status"` success, inline `role="alert"` error, “Saved” resets on the next change.
- Tests: loads server values; toggling enables Save; PATCH receives only changed keys; failure shows the error and keeps values; success announces once.

---

## Phase 2 — Email change (F2)

### Task 2.1: Read-only email + change-email form

**Files:** `src/features/super-admin/Profile.jsx`, `src/shared/components/AccountSettings.jsx` (Security panel), tests `src/features/super-admin/__tests__/Profile.email.test.jsx`
- Profile email input becomes read-only (no validation dependency on it) with helper text “Managed from Security”.
- Security panel gains a “Change email” form (new email + current password for re-auth) → `supabase.auth.updateUser({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })`; success message “Check your inbox to confirm the new address.”

### Task 2.2: Role-table email sync on `/auth/me`

**Files:** `server/src/routes/auth.js:170-183`; test `server/src/routes/auth.me.email-sync.test.js`
- If `req.user.email` is a non-empty string and differs from `found.profile.email`, `update` the resolved role table (`super_admins`/`employers`/`job_seekers`) `set email = $2 where id = $1`, audit `account.email.sync`, and return the fresh row.
- Tests: differing token email syncs exactly one row and audits; matching email does not write; token without email skips; second call is a no-op.

---

## Phase 3 — Security panel: sessions & password (F3, F4)

### Task 3.1: Self-service revoke all sessions

**Files:** `server/src/routes/account.js`; test `server/src/routes/account.sessions.test.js`; client `src/shared/services/account.js`, `src/shared/components/AccountSettings.jsx`
- Route `POST /account/sessions/revoke-all` → GoTrue admin logout for `req.user.id` (reuse the admin route’s helper), audit `account.sessions.revoke`, `{ revoked: true }`; 502 mapping.
- UI: “Sign out all devices” with confirmation in the Security panel → call route, then `supabase.auth.signOut({ scope: 'global' })`, clear caches, redirect `/login`.
- Tests: route calls the upstream endpoint and audits; UI shows confirmation and signs out.

### Task 3.2: Password section on the settings page

**Files:** `src/shared/components/AccountSettings.jsx` (uniform branch), tests
- Render `<ChangePassword />` inside the Security section on `/super-admin/settings` (reuse, no rewrite); keep it on profile pages; add an anchor link from the Profile page (“Manage security in Settings”).
- Test: settings page renders the Password settings panel; profile still renders it (embedded).

---

## Phase 4 — Permission-aware UI (F9)

### Task 4.1: Return permissions from `/auth/me`

**Files:** `server/src/routes/auth.js:170-183`; test `server/src/routes/auth.me.permissions.test.js`
- Add `permissions: req.user.permissions ?? null`, `custom_role_id: req.user.custom_role_id ?? null`, `aal` from the JWT (`req.user.aal`), on both seeker and generic returns.
- Tests: full admin → `permissions: null`; tagged → array; non-admin → `[]`; values never include other users’ data.

### Task 4.2: Client permission helper + nav/settings gating

**Files:** `src/shared/context/AuthProvider.jsx` (expose `permissions`), `src/shared/lib/permissions.js` (new: `hasPermission(user, key)`; null = all), `src/shared/components/TopNavLayout.jsx`, `src/shared/constants.js` (nav items gain `permission`), `src/features/super-admin/Settings.jsx`
- Hide nav entries the caller cannot use; settings page shows a “You don’t have settings.manage” notice and disables reference actions instead of raw 403s.
- Tests: full admin sees all; tagged admin sees only permitted items; settings page read-only state.

### Task 4.3: Surface the bundle in the account menu (ADR-042 follow-up)

**Files:** `src/shared/components/TopNavLayout.jsx`
- Under the role label, show “Custom role: <name>” or “Full administrator”; optional; one small test.

---

## Phase 5 — Reference data editing, reorder, filter (F7, U2)

### Task 5.1: `PATCH /admin/reference/:id`

**Files:** `server/src/routes/admin-reference.js`; `src/shared/services/admin.js`; test `server/src/routes/admin.reference.patch.test.js`
- Body `{ value?, sort_order? }`; reject `custom_role`; trim 1–80 chars; integer `sort_order` (0–9999); 404 missing; 409 duplicate (23505); audit `settings.reference.update`; return the row.
- Tests: rename, reorder, duplicate → 409, custom_role → 400, unknown id → 404, audit.

### Task 5.2: Edit/reorder/filter UI

**Files:** `src/features/super-admin/Settings.jsx`, test extension
- Inline rename (pencil → input + save/cancel), up/down sort buttons sending `sort_order`, and a client-side search input when a list exceeds 8 rows.
- Optimistic-free: update local state from the server response; disable controls while saving; errors inline.
- Tests: rename calls PATCH and updates the row; reorder sends `sort_order`; filter hides non-matches; controls disabled while saving.

---

## Phase 6 — TOTP MFA (F5)

### Task 6.1: Enrollment & unenroll UI

**Files:** `src/shared/components/AccountSettings.jsx` (Security), `src/shared/services/auth.js`; test `src/shared/components/__tests__/Mfa.test.jsx`
- “Enable two-factor authentication” → `supabase.auth.mfa.enroll({ factorType: 'totp' })`, render QR + secret, verify code → `challenge`/`verify`; show enrolled factor with “Disable” (unenroll, requires code).
- Tests: enroll renders QR/secret and verifies; invalid code shows an error; unenroll requires verification.

### Task 6.2: Login AAL2 challenge

**Files:** `src/features/auth/Login.jsx`, `src/shared/context/AuthProvider.jsx`; test `src/features/auth/__tests__/Login.mfa.test.jsx`
- After password sign-in, when `mfa.getAuthenticatorAssuranceLevel()` reports `nextLevel === 'aal2'`, show a code step before routing; cancel signs out.
- Tests: aal2 path asks for a code; valid code routes; cancel signs out.

### Task 6.3: Server-side AAL2 enforcement for admins

**Files:** `server/src/auth.js` (principal), `server/src/middleware/permissions.js` or a new guard; test `server/src/routes/admin.mfa.test.js`
- When the principal has a verified MFA factor (`req.user.factors?.some(f => f.status === 'verified')`) and `aal !== 'aal2'`, `/admin/*` returns `403 MFA_REQUIRED`.
- Tests: aal1 with a verified factor → 403; aal2 → allowed; no factor → allowed.

---

## Phase 7 — Self-service deactivation (F6)

### Task 7.1: Route + guard

**Files:** `server/src/routes/account.js`; test `server/src/routes/account.deactivate.test.js`
- `POST /account/deactivate` with `{ confirm: 'DEACTIVATE' }`; sets the resolved role row `status = 'inactive'`; audit `account.deactivate`; 409 `LAST_ADMIN` when the caller is the last active full super-admin (reuse the admin-users guard); returns `{ deactivated: true }`.
- Tests: confirmation required; status written; last-admin refused; audit.

### Task 7.2: Danger-zone UI + sign-out

**Files:** `src/shared/components/AccountSettings.jsx` (Security), service; test extension
- “Deactivate account” with typed confirmation; on success, global sign-out + redirect; clear copy that an admin can reactivate.

---

## Phase 8 — Cross-links, final polish, verification

### Task 8.1: Profile ↔ Settings links

**Files:** `src/features/super-admin/Profile.jsx`, `src/shared/components/AccountSettings.jsx`
- Profile: link “Manage security & preferences in Settings”. Settings Security: link “Edit profile details”.
- Test: both links resolve to the right routes.

### Task 8.2: Whole-system verification

- `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build`.
- Manual (authenticated): preferences persist across reload; suppress one notification type and confirm it stops; email change confirmation flow; sign-out-all on a second device; MFA enroll + login challenge; deactivation blocked for the last admin; reference rename/reorder; tagged admin sees only permitted nav/settings.
- ADR-052 records: preferences table + gating mapping, email-sync strategy, self-service session revocation limits (access tokens live ≤1h), MFA enforcement model, deactivation policy, permission surfacing.

## Rollback Plan

- Preferences: drop the table; `notifyUser` falls back to ungated when the table is absent (guard the query with a try/catch or `to_regclass`).
- Email sync: revert the `/auth/me` block; role tables keep their current emails.
- MFA: unenroll factors; remove the AAL guard.
- Deactivation: admin PATCH reactivates; no data is deleted.
- Reference PATCH: route removal is additive-safe; rows persist.
