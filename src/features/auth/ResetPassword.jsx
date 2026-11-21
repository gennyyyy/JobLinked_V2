import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { resetPasswordWithToken } from '@/shared/services/auth'
import { passwordError, PASSWORD_HINT } from '@/shared/utils/password'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

const INVALID = 'This reset link is invalid or expired. Request a new one.'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // BA's reset email redirects here with ?token=… — that token is the
  // credential (ADR-056 decision 6), so the form is unusable without it.
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const passwordIssue = passwordError(password)
    if (passwordIssue) {
      setError(passwordIssue)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await resetPasswordWithToken(password, token)
      navigate('/login', { replace: true, state: { reset: true } })
    } catch (err) {
      setError(err.message || INVALID)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <PublicShell>
        <AuthFrame title="Reset link issue." subtitle="We couldn’t open this password link.">
          <div className="flex flex-col gap-5">
            <p role="alert" className="text-xs leading-6 text-destructive">{INVALID}</p>
            <Link to="/forgot-password" className="text-xs font-medium text-primary">Request a new link</Link>
            <Link to="/login" className="text-xs font-medium text-primary">Go to sign in</Link>
          </div>
        </AuthFrame>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <AuthFrame title="A fresh start." subtitle="Choose a new password for your account.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-password">New Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="reset-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={PASSWORD_HINT}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="reset-confirm">Confirm Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="reset-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </InputGroup>
            </Field>
          </FieldGroup>
          {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save New Password'}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <p className="mt-6 text-center text-xs">
          <Link to="/login" className="text-primary">← Back to sign in</Link>
        </p>
      </AuthFrame>
    </PublicShell>
  )
}
