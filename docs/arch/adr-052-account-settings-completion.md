# ADR-052: Account settings completion — persistence, security, and permission-aware UI

**Status:** Accepted (implemented 2026-11-15)
**Date:** 2026-11-15
**Owner:** Lead Architect

## Context

The account/system settings experience was incomplete: notification switches were session-only, the super-admin profile email field was a dead control, password change was isolated on the Profile page, reference data could not be edited or reordered, the UI did not reflect the permission bundle already enforced by the API (ADR-042), and there was no MFA, session revocation, or deactivation path. A re-audit corrected an earlier claim that "settings isn't in the navigation" (it is, via `src/shared/constants.js:60`) and scoped the email gap to the super-admin profile.

## Decision

1. **Preferences persistence.** New additive table `public.user_preferences` (`user_id` PK, `application_updates`, `community_announcements`, `updated_at`), with `GET/PATCH /account/preferences`. Defaults are `true`, so behavior is identical until a user opts out. `notifyUser` gates delivery on the mapped preference (unknown types always delivered); the system broadcast excludes opted-out users via a `left join … coalesce`. `notifyAdmins` stays ungated (operational).
2. **Email change.** Self-service via Supabase `auth.updateUser({ email })` (confirmation link). The role table's email is synced idempotently in `/auth/me` when the token email differs, with an `account.email.sync` audit. The super-admin profile email field is read-only with a pointer to Settings → Security.
3. **Sessions.** `POST /account/sessions/revoke-all` calls GoTrue's admin logout for the caller (service role) and audits; the client also calls `supabase.auth.signOut({ scope: 'global' })`. No device list (YAGNI).
4. **Password change.** Password change stays on the Profile pages only; the system settings page no longer hosts a Password settings panel (Phase 3b reverted).
5. **Deactivation.** Self-service `POST /account/deactivate` sets the role row `status = 'inactive'`, revokes sessions, and audits; the last active full super-admin is refused (`409 LAST_ADMIN`); admins can reactivate via the existing PATCH. Soft, not hard, delete.
6. **Reference data.** `PATCH /admin/reference/:id` (rename + `sort_order`) with `settings.manage`; the UI adds inline rename, up/down reorder, and client-side filter above 8 rows. Categories remain `employment_type` and `education_level`.
7. **Permission-aware UI.** `/auth/me` returns `permissions` (`null` = full admin, array = bundle, `[]` = non-admin), `custom_role_id`, and `aal`. Nav entries and settings actions are gated by `hasPermission`; the API remains the authority.
8. **Accessibility.** Scrollable card bodies are keyboard-focusable (`tabIndex={0}`, `role="region"`), sections use `aria-labelledby`, and save confirmations use `role="status"`.

## Consequences

- Account preferences are now durable and honored by `notifyUser`/broadcast; defaults preserve every existing notification.
- Email changes are verified by Supabase and synced lazily and idempotently; the dead profile field is gone.
- Admin accounts gain TOTP MFA with server-side AAL2 enforcement; enrollment is optional but enforced once enrolled.
- Deactivation is reversible and audited; the last full admin is protected.
- The settings UI is permission-aware and accessible; reference data is editable/reorderable.
- No changes to the letter-reveal animation, parallax, or other portals' stat cards.
- One additive schema change (`user_preferences`); rollback is `drop table`.

## Follow-ups (not blocking)

- MFA enforcement fails open on a GoTrue network error (availability over security); the client challenge remains the primary gate.
- Reference lists have no server-side search (client-side filter only; lists are small).
- Account deletion is deactivation, not hard delete, per data-retention policy.
- `workspaceSearch.js` must be kept in sync with new settings sections (Phase 0 added entries).
