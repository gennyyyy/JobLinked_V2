import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { resendVerificationEmail } from '@/shared/services/auth'

const COOLDOWN_SECONDS = 60

// Shared by both registration success screens and the unverified sign-in
// failure: resend the verification link once, then sit out BA's rate limit.
export default function VerificationResend({ email }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  // State alone lags a fast double-click by one render; the ref does not.
  const inFlight = useRef(false)

  const cooling = seconds > 0

  useEffect(() => {
    if (!cooling) return undefined
    const id = setInterval(() => setSeconds((s) => (s > 1 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [cooling])

  if (!email) return null

  async function handleResend() {
    if (inFlight.current || cooling) return
    inFlight.current = true
    setSending(true)
    setSent(false)
    setError('')
    try {
      await resendVerificationEmail(email)
      setSent(true)
      setSeconds(COOLDOWN_SECONDS)
    } catch (err) {
      setError(err?.message || 'We couldn\u2019t send the email. Please try again.')
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const label = sending ? 'Sending\u2026' : cooling ? `Resend in ${seconds}s` : 'Resend verification email'

  return (
    <div className="flex flex-col gap-2">
      {sent && (
        <p role="status" className="text-xs leading-6 text-success">
          Verification email sent. Check your inbox.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 self-start px-4"
        disabled={sending || cooling}
        onClick={handleResend}
      >
        {label}
      </Button>
    </div>
  )
}
