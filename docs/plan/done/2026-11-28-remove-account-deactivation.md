# Remove Self-Service Account Deactivation (Keep Permanent Deletion)

**Status:** Confirmed by user 2026-11-28. Bounded change.

## What

Job-seekers and employers keep the "Delete account permanently" (erasure) option. The self-service "Deactivate account" option is removed from the product. The backend endpoint `POST /account/deactivate` is removed (404 after change).

## Why

Deactivation (soft-disable, admin-reactivatable) is redundant next to RA 10173 erasure and confuses the account-closure flow.

## How — exact changes

### Backend
- `server/src/routes/account.js`
  - Delete the `router.post('/account/deactivate', ...)` handler (currently lines 85–115), including the super-admin LAST_ADMIN guard. 
  - KEEP: `gotrueLogout` helper (used by `/account/sessions/revoke-all` and `DELETE /account`), `ROLE_TABLE`, erasure route, export route, preferences.
  - Update the erasure 403 message "Super-admin accounts use deactivation" if it now reads stale.
- Delete `server/src/routes/account.deactivate.test.js`.

### Frontend
- `src/shared/services/account.js` — delete `deactivateAccount()`.
- `src/shared/components/DangerZonePanel.jsx` — remove deactivate state/handler/button and its copy; panel becomes deletion-only ("Danger zone" / permanent deletion). Keep `canErase` guard (erasure 403s super-admins) and the type-DELETE confirmation flow.
- `src/features/super-admin/Profile.jsx` — remove the direct `DangerZonePanel` usage (super-admins could only deactivate; erasure 403s them). Update the Security tab description copy that mentions account deactivation.
- `src/shared/components/AccountSettings.jsx` — it already hides `DangerZonePanel` for super-admins (line ~212); with deactivation gone, non-super-admin rendering is unchanged. No change expected; verify.

### Tests
- `src/shared/services/__tests__/account.test.js` — remove the `deactivateAccount` describe block/import.
- `src/shared/components/__tests__/AccountSettings.danger.test.jsx` — remove deactivate mocks/assertions; keep erasure assertions.
- `src/features/super-admin/__tests__/Profile.email.test.jsx` — remove the deactivate button mock/assertion; keep sign-out-all-sessions assertion.

## Do NOT touch

- Role-move internal deactivation (`admin-users.js`, `auth.js` status checks, `b2-role-move.test.js`) — load-bearing admin invariant.
- Admin user suspension flows.
- `DELETE /account` erasure semantics, `GET /account/export`, `POST /account/sessions/revoke-all`.
- `db/schema.sql` — no schema changes.
- Admin ability to remove super-admin accounts through user management (unchanged).

## Done when

- `npm test` passes.
- `npm run lint` passes.
- Job-seeker Profile → Account Settings and Employer Company Profile → Account Settings each show a Danger zone with only "Delete account permanently" (type DELETE to confirm); no deactivate button anywhere.
- `POST /api/account/deactivate` returns 404.

## Assumptions (confirmed)

- Super-admins lose self-service account removal; other admins manage their accounts. Erasure still 403s super-admins.
- No grace period, no data migration, no schema change.
