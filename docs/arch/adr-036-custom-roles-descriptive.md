# ADR-036 — Custom roles are descriptive, not an authorization boundary

**Status:** Accepted 2026-11-04 (Lead Architect; option A of `docs/plan/done/2026-11-04-04-security-compliance-plan.md`)

## Context

`custom_role_id` references `reference_data.details` jsonb holding
`{permissions[], base_role}`. The super-admin UI edits bundles, but every
sensitive endpoint already gates on `requireRole('super-admin')`; the bundles
only shape what the SPA renders. No second admin tier exists in the product,
and there is no route→permission mapping in code.

## Decision

- The role gate (`super-admin`) is the only authorization boundary.
- Custom-role permission bundles remain descriptive UI metadata. Document that
  at the point the bundles are read (`RoleManagement`/`UserManagement`), and pin
  the boundary with one test asserting an admin route rejects a non-super-admin.
- Do **not** build permission enforcement middleware now.

## Consequences

- Editing a permission bundle can never grant data access.
- If PESO ever needs delegated sub-admins, that is a new ADR + middleware work
  (route→permission map, enforcement tests), not an incremental tweak.
- The in-code caveat ("not enforced") is the contract; do not remove it.
