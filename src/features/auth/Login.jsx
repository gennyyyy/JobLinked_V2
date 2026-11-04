import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { signIn } from '@/shared/services/auth'
import { PORTALS } from '@/shared/constants'
import useAuth from '@/shared/hooks/useAuth'
import LoadingScreen from '@/shared/components/LoadingScreen'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

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

  const signedInRole = role || user?.role
  const homePath = PORTALS.find((p) => p.key === signedInRole)?.homePath

  if (loading) return <LoadingScreen />
  if (user && homePath) return <Navigate to={homePath} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const loggedIn = await signIn(email.trim(), password)
      // First login after provisioning: the AuthProvider's SIGNED_IN listener
      // may have fetched /auth/me before the profile row existed, leaving its
      // `user` null. Seed the provider with the profile signIn already resolved
      // before routing, so ProtectedRoute sees the session on the first attempt.
      authenticate?.(loggedIn)
      navigate(PORTALS.find((p) => p.key === loggedIn.role)?.homePath || '/')
    } catch (err) {
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
