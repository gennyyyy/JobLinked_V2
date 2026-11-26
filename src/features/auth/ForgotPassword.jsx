import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { resetPassword } from '@/shared/services/auth'
import useCaptcha from '@/shared/hooks/useCaptcha'
import useCooldown from '@/shared/hooks/useCooldown'
import Turnstile from '@/shared/components/Turnstile'
import PublicShell from '@/shared/components/PublicShell'
import Flash from '@/shared/components/Flash'
import AuthFrame from './AuthFrame'

const COOLDOWN_KEY = 'joblinked:password-reset-cooldown'
const COOLDOWN_MS = 60_000

const normalizeEmail = (value) => value.trim().toLowerCase()

// localStorage is only the UI mirror of the server's per-email 60s window; the
// server enforces it and answers 429 either way. Unreadable records are dropped.
function readCooldown() {
  try {
    const record = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || 'null')
    if (record && typeof record.email === 'string' && typeof record.until === 'number') return record
  } catch { /* fall through to clearing the bad record */ }
  localStorage.removeItem(COOLDOWN_KEY)
  return null
}

function writeCooldown(email) {
  try {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ email, until: Date.now() + COOLDOWN_MS }))
  } catch { /* storage unavailable: the in-memory countdown still holds */ }
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const captcha = useCaptcha()
  const cooldown = useCooldown()
  // State alone lags a fast double-click by one render; the ref does not.
  const inFlight = useRef(false)
  const { start: startCooldown, stop: stopCooldown } = cooldown

  // Restore the remaining countdown when the typed address matches a live
  // record (e.g. after navigating away and back); anything else clears it.
  useEffect(() => {
    const key = normalizeEmail(email)
    const record = readCooldown()
    if (!record) {
      stopCooldown()
      return
    }
    if (record.until <= Date.now()) {
      localStorage.removeItem(COOLDOWN_KEY)
      stopCooldown()
      return
    }
    if (record.email === key) startCooldown(Math.ceil((record.until - Date.now()) / 1000))
    else stopCooldown()
  }, [email, startCooldown, stopCooldown])

  async function handleSubmit(event) {
    event.preventDefault()
    if (inFlight.current || cooldown.cooling) return
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
    inFlight.current = true
    setBusy(true)
    const normalized = normalizeEmail(email)
    try {
      await resetPassword(email.trim(), captcha.token)
      setSuccess(true)
      writeCooldown(normalized)
      cooldown.start()
    } catch (err) {
      captcha.reset() // single-use token: the next attempt needs a fresh one
      // 429 means the server's window (1 per email per 60s, IP backstop 3 per
      // 60s) is still open: mirror it instead of retrying into another 429.
      if (err.code === 'RATE_LIMITED') {
        writeCooldown(normalized)
        cooldown.start()
      }
      setError(err.message || 'Could not send reset link. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const label = busy
    ? 'Sending…'
    : cooldown.cooling ? `Send again in ${cooldown.seconds}s` : 'Send Reset Link'

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
            <Flash>Check your email for reset instructions</Flash>
          )}
          {captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}
          <Button type="submit" disabled={busy || cooldown.cooling}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {label}
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
