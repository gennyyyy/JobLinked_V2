// One place owns display-name resolution and initials derivation (ADR-032 §1).
// Moved verbatim out of SidebarAccount so the sidebar and the header account
// menu cannot drift. Callers keep their own render-time fallback.
export function displayName(user, fallback) {
  return user?.full_name || user?.name || user?.email || fallback;
}

export function initialsOf(user, fallback) {
  const name = displayName(user, fallback) || "";
  const nameParts = name.split(/\s+/).filter(Boolean);
  return user?.first_name || user?.last_name
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()
    : (nameParts.length > 1 ? `${nameParts[0][0]}${nameParts.at(-1)[0]}` : nameParts[0]?.[0] || "").toUpperCase();
}
