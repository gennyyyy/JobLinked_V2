import { Link, useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

// ?type= picks the copy for the kind of link that expired; anything else gets
// the generic version. Resend for a verification link lives on /login.
const BODIES = {
  reset: 'This password reset link is invalid or has expired.',
  verify: 'This verification link is invalid or has expired.',
  invite: 'This invite link is invalid or has expired. Ask your administrator to send a new invite.',
}
const GENERIC = 'This link is invalid or has expired.'

export default function LinkExpired() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')

  return (
    <PublicShell>
      <AuthFrame title="This link has expired." subtitle="It’s no longer valid.">
        <div className="flex flex-col gap-5">
          <p className="text-xs leading-6 text-muted-foreground">
            {type && Object.hasOwn(BODIES, type) ? BODIES[type] : GENERIC}
          </p>
          {type !== 'verify' && type !== 'invite' && (
            <Link to="/forgot-password" className="text-xs font-medium text-primary">
              Request a new reset link
            </Link>
          )}
          <Link to="/login" className="text-xs font-medium text-primary">Go to sign in</Link>
        </div>
      </AuthFrame>
    </PublicShell>
  )
}
