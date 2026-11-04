import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { supabase } from '@/shared/lib/supabase'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Could not reset password. The link may have expired.')
    } finally {
      setBusy(false)
    }
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
                  placeholder="Min. 8 characters"
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
