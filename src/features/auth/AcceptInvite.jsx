import { Navigate, useSearchParams } from 'react-router-dom'

// Admin invites no longer create an authenticated session: the server emails a
// Better Auth reset link, so a new invite arrives at /reset-password?token=…
// (ADR-056 decisions 7/11). This route survives only for links generated before
// the cutover: forward any token, otherwise point at the expired-link page.
export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  if (token) {
    const query = new URLSearchParams({ token }).toString()
    return <Navigate to={`/reset-password?${query}`} replace />
  }

  return <Navigate to="/link-expired?type=invite" replace />
}
