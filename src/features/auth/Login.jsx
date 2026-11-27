import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { signIn, completeTwoFactor, signOut } from '@/shared/services/auth'
import { takeApplyIntent } from '@/shared/lib/applyIntent'
import { PORTALS } from '@/shared/constants'
import useAuth from '@/shared/hooks/useAuth'
import useCaptcha from '@/shared/hooks/useCaptcha'
import LoadingScreen from '@/shared/components/LoadingScreen'
import Turnstile from '@/shared/components/Turnstile'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'
import VerificationResend from './VerificationResend'
import { Panel, TextField } from '@/shared/components/design'

// One sign-in form for every account. The role comes from the profile the API
// returns, so there is no portal to pick and no per-portal login route: a
// signed-in visitor is forwarded straight to their own workspace.
function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, loading, authenticate } = useAuth()
  const [error, setError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const captcha = useCaptcha()

  const signedInRole = role || user?.role
  const homePath = PORTALS.find((p) => p.key === signedInRole)?.homePath
  const portalPath = (nextRole) => PORTALS.find((p) => p.key === nextRole)?.homePath || '/'

  if (loading) return <LoadingScreen />
  if (user && homePath) {
    const applyPath = takeApplyIntent()
    return <Navigate to={applyPath && signedInRole === 'job-seeker' ? applyPath : homePath} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setUnverifiedEmail('')
    if (captcha.required && !captcha.token) {
      setError('Please complete the verification challenge.')
      return
    }
    setBusy(true)
    try {
      const loggedIn = await signIn(email.trim(), password, captcha.token)
      // The account has TOTP: BA set no session, so ask for the code first.
      if (loggedIn.twoFactorRedirect) {
        setMfaStep(true)
        return
      }
      // Seed the provider with the profile signIn already resolved so
      // ProtectedRoute sees the session on the first attempt.
      authenticate?.(loggedIn)
      const applyPath = takeApplyIntent()
      navigate(applyPath && loggedIn.role === 'job-seeker' ? applyPath : portalPath(loggedIn.role))
    } catch (err) {
      captcha.reset() // single-use token: the next attempt needs a fresh one
      // A verified account with no role row finishes provisioning on its own
      // page — the session is kept alive there.
      if (err?.needsProvision || /needs provision/i.test(err.message || '')) {
        navigate('/complete-registration', { replace: true })
        return
      }
      setError(err.message || 'Invalid email or password')
      // Only an unverified account gets a resend; every other failure keeps
      // today's single error line.
      if (err?.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(email.trim())
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyMfa() {
    if (mfaCode.length !== 6) return
    setMfaLoading(true)
    setMfaError('')
    try {
      // BA sets the session cookie on a valid code; the service then resolves
      // the session user and their profile.
      const loggedIn = await completeTwoFactor(mfaCode)
      authenticate?.(loggedIn)
      const applyPath = takeApplyIntent()
      navigate(applyPath && loggedIn.role === 'job-seeker' ? applyPath : portalPath(loggedIn.role))
    } catch (err) {
      setMfaError(err?.message || 'Invalid code')
      setMfaCode('')
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleCancelMfa() {
    // The half-signed-in session is useless without the code step.
    await signOut()
    setMfaStep(false)
    setMfaCode('')
    setMfaError('')
  }

  if (mfaStep) {
    return (
      <PublicShell>
        <AuthFrame title="Two-factor authentication" subtitle="Enter the code from your authenticator app.">
          <Panel title="Verification code">
            <div className="flex flex-col gap-4">
              <TextField
                label="Verification code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
              />
              {mfaError && <p role="alert" className="text-xs leading-6 text-destructive">{mfaError}</p>}
              <div className="flex gap-2">
                <Button type="button" disabled={mfaLoading || mfaCode.length !== 6} onClick={handleVerifyMfa}>
                  {mfaLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
                  {mfaLoading ? 'Verifying…' : 'Verify'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelMfa} disabled={mfaLoading}>
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        </AuthFrame>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <AuthFrame title="Welcome back." subtitle="A new opportunity could be waiting for you.">
        {location.state?.invited ? (
          <p className="text-xs leading-6 text-muted-foreground">Your password is set. Sign in to continue.</p>
        ) : null}
        {location.state?.reset ? (
          <p role="status" className="text-xs leading-6 text-muted-foreground">Your password was updated. Sign in with your new password.</p>
        ) : null}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-email">Email address</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="login-password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton type="button" aria-label={show ? 'Hide' : 'Show'} size="icon-sm" onClick={() => setShow((v) => !v)}>
                    {show ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
          {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}
          {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
          {unverifiedEmail && <VerificationResend email={unverifiedEmail} />}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {busy ? 'Signing in…' : 'Sign In'}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center font-medium text-primary">Forgot password?</Link>
          <Link to="/signup" className="inline-flex min-h-11 items-center font-medium text-primary">Register here</Link>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="font-medium text-primary">← Back to home</Link>
        </p>
      </AuthFrame>
    </PublicShell>
  )
}

export default Login