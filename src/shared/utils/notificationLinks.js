// Resolve a stored notification link to an in-portal SPA destination.
// Seeker-scoped public paths (/jobs/:id) would bounce through PublicRoute and
// destroy the session, so prefix them with the seeker portal. Legacy
// employer route mapping stays here so old rows keep working.
export function resolveNotificationLink(n, role) {
  const raw = (n?.link || "").trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("mailto:")) return null;
  if (!raw.startsWith("/")) return null;
  if (raw === "/employer/jobs" || raw.startsWith("/employer/jobs/")) {
    return raw.replace("/employer/jobs", "/employer/job-posts");
  }
  if (role === "job-seeker" && (raw === "/jobs" || raw.startsWith("/jobs/"))) {
    return `/job-seeker${raw}`;
  }
  return raw;
}
