import PublicShell from '@/shared/components/PublicShell'
import { LinkButton, Notice, SuccessMark } from '@/shared/components/design'
import AuthFrame from './AuthFrame'

export default function JobSeekerRegisterSuccess({ needsConfirmation, submittedEmail }) {
  return (
    <PublicShell>
      <AuthFrame
        title={needsConfirmation ? 'Check your email.' : 'Registration complete.'}
        subtitle={needsConfirmation ? 'One more step to activate your account.' : 'Welcome to JobLinked.'}
      >
        <div className="flex flex-col gap-5">
          <SuccessMark />
          <Notice title={needsConfirmation ? 'Verify your email' : 'Account ready'}>
            {needsConfirmation
              ? `We sent a verification link to ${submittedEmail || 'your email'}. Open it to activate your account, then sign in to the portal.`
              : 'Your JobLinked applicant account has been created. You can now log in and apply to verified Santa Maria postings.'}
          </Notice>
          <LinkButton href="/job-seeker/login">Sign In to Portal →</LinkButton>
        </div>
      </AuthFrame>
    </PublicShell>
  )
}
