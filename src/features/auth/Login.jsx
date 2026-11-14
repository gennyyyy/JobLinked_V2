import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { signIn, listMfaFactors } from '@/shared/services/auth'
import { supabase } from '@/shared/lib/supabase'
import { PORTALS } from '@/shared/constants'
import useAuth from '@/shared/hooks/useAuth'
import useCaptcha from '@/shared/hooks/useCaptcha'
import LoadingScreen from '@/shared/components/LoadingScreen'
import Turnstile from '@/shared/components/Turnstile'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'
import { Panel, TextField } from '@/shared/components/design'

// One sign-in form for every account. The role comes from the profile the API
// returns, so there is no portal to pick and no per-portal login route: a
// signed-in visitor is forwarded straight to their own workspace.
function Login() {
  const navigate = useNavigate()
  const { user, role, loading, authenticate } = useAuth()
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [afterLoginPath, setAfterLoginPath] = useState('/')
  const pendingUser = useRef(null)
  const captcha = useCaptcha()

  const signedInRole = role || user?.role
  const homePath = PORTALS.find((p) => p.key === signedInRole)?.homePath

  if (loading) return <LoadingScreen />
  if (user && homePath) return <Navigate to={homePath} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (captcha.required && !captcha.token) {
      setError('Please complete the verification challenge.')
      return
    }
    setBusy(true)
    try {
      const loggedIn = await signIn(email.trim(), password, captcha.token)
      // First login after provisioning: the AuthProvider's SIGNED_IN listener
      // may have fetched /auth/me before the profile row existed, leaving its
      // `user` null. Seed the provider with the profile signIn already resolved
      // before routing, so ProtectedRoute sees the session on the first attempt.
      const destination = PORTALS.find((p) => p.key === loggedIn.role)?.homePath || '/'

      // AAL2 challenge: if the account has a verified TOTP factor and the
      // session is only AAL1, ask for a code before routing.
      let needsMfa = false
      let factorId = null
      try {
        const aalRes = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        const aalData = aalRes?.data ?? aalRes
        const nextLevel = aalData?.nextLevel ?? aalData?.next_level
        if (nextLevel === 'aal2') {
          const factors = typeof listMfaFactors === 'function' ? await listMfaFactors() : []
          const verified = (Array.isArray(factors) ? factors : []).find(
            (f) => f?.status === 'verified' || f?.status == null,
          )
          if (verified) {
            needsMfa = true
            factorId = verified.id
          }
        }
      } catch {
        needsMfa = false
      }

      if (needsMfa) {
        pendingUser.current = loggedIn
        setAfterLoginPath(destination)
        setMfaFactorId(factorId)
        setBusy(false)
        return
      }

      authenticate?.(loggedIn)
      navigate(destination)
    } catch (err) {
      captcha.reset() // single-use token: the next attempt needs a fresh one
      // An unprovisioned account (valid Supabase session but no local profile)
      // used to show the raw "needs provision" error and leave the visitor
      // stuck. Route them to the recovery page instead — the session is kept
      // alive there, and they can provision without signing up a new account.
      if (/needs provision/i.test(err.message || '')) {
        navigate('/complete-registration', { replace: true })
        return
      }
      setError(err.message || 'Invalid email or password')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyMfa() {
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaLoading(true)
    setMfaError('')
    try {
      const challengeRes = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      const challengeData = challengeRes?.data ?? challengeRes
      const challengeError = challengeRes?.error
      if (challengeError) throw challengeError
      const challengeId = challengeData?.id ?? challengeData?.challengeId
      const verifyRes = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId,
        code: mfaCode,
      })
      const verifyError = verifyRes?.error
      if (verifyError) throw verifyError
      authenticate?.(pendingUser.current)
      navigate(afterLoginPath)
    } catch (err) {
      captcha.reset()
      setMfaError(err?.message || 'Invalid code')
      setMfaCode('')
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleCancelMfa() {
    try {
      await supabase.auth.signOut()
    } catch {
      /* best-effort */
    }
    pendingUser.current = null
    setMfaFactorId(null)
    setMfaCode('')
    setMfaError('')
    setAfterLoginPath('/')
  }

  if (mfaFactorId) {
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