import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { resendVerificationEmail } from '@/shared/services/auth'
import useCooldown from '@/shared/hooks/useCooldown'

// Shared by both registration success screens and the unverified sign-in
// failure: resend the verification link once, then sit out BA's rate limit.
export default function VerificationResend({ email }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { seconds, cooling, start } = useCooldown()
  // State alone lags a fast double-click by one render; the ref does not.
  const inFlight = useRef(false)

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
      start()
    } catch (err) {
      // The server's 3/60 bucket was hit: hold the button for the same window.
      if (err?.code === 'RATE_LIMITED') start()
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
