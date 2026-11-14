export function hasPermission(user, key) {
  if (!user) return false
  // null AND undefined both mean "no custom role" — undefined is what an API
  // older than ADR-042 sends. Mirrors the server's break-glass rule so a
  // version skew cannot hide every gated page from the full admin.
  if (user.permissions == null) return true
  return Array.isArray(user.permissions) && user.permissions.includes(key)
}
