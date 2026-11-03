import { Link } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import { LinkButton, Notice, SuccessMark } from '@/shared/components/design'
import AuthFrame from './AuthFrame'

export default function EmployerRegisterSuccess({ needsConfirmation }) {
  return (
    <PublicShell>
      <AuthFrame
        title={needsConfirmation ? 'Check your email.' : 'Application submitted.'}
        subtitle={needsConfirmation ? 'One more step to activate your account.' : 'Your accreditation is now with PESO.'}
      >
        <div className="flex flex-col gap-5">
          <SuccessMark />
          <Notice title={needsConfirmation ? 'Verify your email' : 'Pending verification'}>
            {needsConfirmation
              ? "We sent a verification link to your company email. Confirm it, then sign in — you'll finish setting up your company profile on first login."
              : 'Your business accreditation application is now being reviewed by the Santa Maria PESO staff.'}
          </Notice>
          <LinkButton href="/employer/login">Go to Login →</LinkButton>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="text-primary">Return to home</Link>
          </p>
        </div>
      </AuthFrame>
    </PublicShell>
  )
}
