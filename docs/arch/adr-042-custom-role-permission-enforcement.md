# ADR-042 — Custom-role permission bundles are enforced by the API

**Status:** Accepted 2026-11-10 (Lead Architect; closes register row G3)

## Context

Custom roles are defined in super-admin → Role Management. Each stores a permission
bundle (`dashboard.view`, `accreditation.manage`, `jobs.manage`, `users.manage`,
`roles.manage`, `reports.view`, `logs.view`, `notifications.send`,
`settings.manage`) on its `reference_data` row, and a user row can point at one via
`custom_role_id` (FK `on delete set null`). Until now the bundle only shaped what the
SPA rendered: every API endpoint gated on `requireRole(...)` alone, so a super-admin
tagged with a "reports only" bundle could still call every `/admin/*` endpoint.
The in-app copy even said so ("they do not replace API role checks").
Register row G3, severity High.

## Decision

**A custom role is an allow-list for the super-admin API surface.**

1. A super-admin **without** `custom_role_id` keeps full access. The three system
   roles stay fixed and the seeded/PESO admin holds no bundle — this is the
   break-glass path, so at least one such account must always exist.
2. A super-admin **with** `custom_role_id` may only call endpoints whose permission
   key is in the bundle; anything else is `403 FORBIDDEN` naming the missing key.
3. Non-super-admin roles are unaffected — their endpoints stay role-scoped
   (`requireRole('employer')`, ownership checks, etc.).
4. The bundle is resolved **once per request** together with the principal
   (`resolveRole`, already the single round-trip for `role` + `profile`), so
   enforcement costs no extra query. `auth.js` attaches `customRoleId` and
   `permissions` to `req.user`.
5. `requirePermission(...keys)` (`server/src/middleware/permissions.js`) runs **after**
   `auth` + `requireRole('super-admin')` and denies unless the bundle holds one of
   the listed keys. A principal that carries neither field (auth not resolved, or a
   test double) is treated as a system admin: production always resolves both, and
   failing closed there would 403 every mocked-auth harness for no security gain.
6. Deleting a role nulls the assignment (FK), so a dangling id cannot lock anyone out.

### Key → endpoint mapping

| Permission | Endpoints |
|---|---|
| `dashboard.view` | `GET /admin/stats`, `/admin/companies`, `/admin/applications`, `/admin/employees`, `/admin/referrals`, `/admin/seekers/:id/{education,experience,employment,resumes}` |
| `accreditation.manage` | `GET /admin/accreditations` |
| `jobs.manage` | all of `admin-jobs.js` (`/admin/jobs*`) |
| `users.manage` | all of `admin-users.js` (`/admin/users*`) |
| `roles.manage` | `GET/POST/PATCH/DELETE /admin/roles*`, `GET /admin/permissions` |
| `reports.view` | `GET /admin/reports/:type/export` |
| `logs.view` | `GET /admin/audit-logs` |
| `notifications.send` | `POST /admin/system-notifications` |
| `settings.manage` | `/admin/reference/:category` (read + write) |

`GET /admin/roles` also accepts `users.manage`, because User Management needs the role
list to assign one — a users-only admin must not be blocked from their own page.

## Consequences

- The bundle is now a real authorization boundary; the Role Management copy changes
  from "they do not replace API role checks" to an enforced statement.
- **Lockout is possible by design**: assigning yourself a narrow bundle removes your
  own access to the pages you would use to widen it. Recovery is another super-admin
  without a bundle (break-glass), or a direct DB update. Note it in the ops runbook.
- The SPA still renders every nav item; a limited admin who clicks a denied page sees
  the API's 403 rather than a hidden link. Hiding nav items from the bundle is a
  follow-up, not a security control.
- `permissions` now rides on the principal, so the token/principal cache (ADR-028) and
  the request memo both serve it; no schema change was needed.

## Follow-ups (not blocking)

- Filter `PORTAL_NAV` items by the caller's bundle so limited admins do not see pages
  they cannot open.
- Surface the caller's own bundle in the account menu ("Reports only") so an admin can
  tell why an endpoint refused.
