# ADR-038 — Staff is a restricted custom role, not a fourth role [ACCEPTED 2026-11-03]

## Context
The UI models four actors: admin, staff, employer, jobseeker. The backend has three roles
(`super-admin`, `employer`, `job-seeker`) plus `super_admins.custom_role_id` pointing at custom
roles that already live in `reference_data` with `details.permissions[]`. The UI needs a staff
member to reach only some admin sections.

Adding a fourth role value would touch every route, guard, trigger, and enum in the system.

## Decision
- **No new role value and no new table.** Staff = a `super-admin` account whose `custom_role_id` is set.
- Backend: add `requirePermission(token)` beside `requireRole('super-admin')`. A null custom role
  passes everything (full admin); a set custom role must contain the token, else
  `403 { error: { code: "FORBIDDEN", message: "Missing permission: <token>" } }`.
- Permission tokens: `jobs`, `employees`, `accreditation`, `reports`, `roles`, `announcements`,
  `audit`. `GET /api/admin/stats` needs none (any active admin).
- `GET /api/auth/me` returns `custom_role: { id, name, permissions } | null`.
- UI maps `role === 'admin' && custom_role != null` → staff presentation and per-section gating;
  `canOpenSection(permissions, section)` is the single gate.

## Consequences
- Scoping is **section-level only** (`all` vs `none`); "assigned jobs/employees" scopes are out of
  scope for this migration.
- A custom role with no permissions locks its holder out of every gated section but still allows
  `stats` — deliberate, and the empty state tells them so.
- Permission checks cost one extra `reference_data` read per request, memoized per request.

## Alternatives
- **Fourth role + role refactor** — largest diff, touches every route and enum, for a distinction
  that is really a permission set. Rejected.
- **Client-only gating** — no enforcement; a staff member could call admin endpoints directly.
  Rejected.
