import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { resetPassword } from '@/shared/services/auth'
import useCaptcha from '@/shared/hooks/useCaptcha'
import Turnstile from '@/shared/components/Turnstile'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const captcha = useCaptcha()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    if (captcha.required && !captcha.token) {
      setError('Please complete the verification challenge.')
      return
    }
    setBusy(true)
    try {
      await resetPassword(email.trim(), captcha.token)
      setSuccess(true)
    } catch (err) {
      captcha.reset() // single-use token: the next attempt needs a fresh one
      setError(err.message || 'Could not send reset link. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <AuthFrame title="Let’s get you back on track." subtitle="Enter your email and we’ll send a time-limited reset link.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </InputGroup>
            </Field>
          </FieldGroup>
          {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
          {success && (
            <p role="status" className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">
              Check your email for reset instructions
            </p>
          )}
          {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {busy ? 'Sending…' : 'Send Reset Link'}
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
