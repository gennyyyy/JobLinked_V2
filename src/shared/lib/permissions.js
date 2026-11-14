export function hasPermission(user, key) {
  if (!user) return false
  if (user.permissions === null) return true   // full admin
  return Array.isArray(user.permissions) && user.permissions.includes(key)
}
