import { Link, Navigate, useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

// Admin invites no longer create an authenticated session: the server emails a
// Better Auth reset link, so a new invite arrives at /reset-password?token=…
// (ADR-056 decisions 7/11). This route survives only for links generated before
// the cutover: forward any token, otherwise keep the invalid-link notice.
export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  if (token) {
    const query = new URLSearchParams({ token }).toString()
    return <Navigate to={`/reset-password?${query}`} replace />
  }

  return (
    <PublicShell>
      <AuthFrame title="Invite link issue." subtitle="We couldn’t open this invitation.">
        <div className="flex flex-col gap-5">
          <p role="alert" className="text-xs leading-6 text-destructive">This invite link is invalid or expired.</p>
          <Link to="/forgot-password" className="text-xs font-medium text-primary">Request a new link</Link>
          <Link to="/login" className="text-xs font-medium text-primary">Go to sign in</Link>
        </div>
      </AuthFrame>
    </PublicShell>
  )
}
