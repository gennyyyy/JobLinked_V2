import { useEffect, useState } from 'react'
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

function Login({ portalKey }) {
  const portal = portalKey ? PORTALS.find((p) => p.key === portalKey) : null
  const navigate = useNavigate()
  const { user, role: currentRole, loading, logout } = useAuth()
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // ADR-021 rule 2: session with a different role — destroy it, show this portal's login form.
  useEffect(() => {
    if (!portalKey) return
    if (!loading && user && portal && currentRole !== portalKey && !resetDone) {
      Promise.resolve(typeof logout === 'function' ? logout() : null).then(() => setResetDone(true), () => setResetDone(true))
    }
  }, [loading, user, portal, currentRole, portalKey, resetDone, logout])

  if (portalKey && !portal) return <Navigate to="/" replace />
  if (loading) return <LoadingScreen />
  if (portal && user && currentRole === portalKey) return <Navigate to={portal.homePath} replace />
  if (!portalKey && user) {
    const home = PORTALS.find((p) => p.key === currentRole)?.homePath
    if (home) return <Navigate to={home} replace />
  }
  if (user && !resetDone) return <LoadingScreen />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const loggedIn = await signIn(email.trim(), password)
      navigate(PORTALS.find((p) => p.key === loggedIn.role)?.homePath || '/')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setBusy(false)
    }
  }

  const subtitle = portal
    ? `Sign in to the ${portal.name} to continue.`
    : 'A new opportunity could be waiting for you.'

  return (
    <PublicShell>
      <AuthFrame title="Welcome back." subtitle={subtitle}>
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
          {(!portal || portal.key !== 'super-admin') && (
            <Link to={portal ? `/register/${portal.key}` : '/signup'} className="inline-flex min-h-11 items-center font-medium text-primary">Register here</Link>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to={portal ? '/portals' : '/'} className="font-medium text-primary">{portal ? '← Back to portals' : '← Back to home'}</Link>
        </p>
      </AuthFrame>
    </PublicShell>
  )
}

export default Login
