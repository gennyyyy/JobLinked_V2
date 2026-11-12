import { err } from '../util.js';

// ADR-042: a custom role is an allow-list for the super-admin API surface.
//
// Runs AFTER `auth` + `requireRole('super-admin')`, whose principal already carries
// `customRoleId` and `permissions` (both resolved in auth.js's resolveRole, one
// round-trip, no extra query here). Rules:
//   - no custom role assigned  -> full access (break-glass system admin)
//   - custom role assigned     -> only the keys in its bundle
//   - neither field present    -> treated as a system admin. Production always
//     resolves both; failing closed here would only 403 mocked-auth test harnesses.
//
// Any of the listed keys satisfies the check, so one route can accept the two that
// legitimately overlap (GET /admin/roles serves both the Roles and Users pages).
// G-02 "cannot grant what you lack": the first key in `keys` the caller does
// not hold itself, or null when the whole grant is within its ceiling. A
// break-glass admin (no custom role) holds the full catalogue; a tagged admin
// holds exactly its bundle. Shared by every grant site (invite, role writes,
// custom-role assignment) so no path can hand out more than it has.
export function unheldKey(req, keys) {
  if (!req.user?.customRoleId) return null;
  const held = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  return (Array.isArray(keys) ? keys : []).find((key) => !held.includes(key)) ?? null;
}

export function requirePermission(...keys) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.user) return err(res, 401, 'UNAUTHORIZED', 'Sign in required');
    if (req.user.role !== 'super-admin') return err(res, 403, 'FORBIDDEN', 'Super-admin access required');
    if (!req.user.customRoleId) return next();

    const granted = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (keys.some((key) => granted.includes(key))) return next();

    return err(res, 403, 'FORBIDDEN', `Your assigned role does not include "${keys.join('" or "')}"`);
  };
}

export default requirePermission;
