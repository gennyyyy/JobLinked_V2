import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { supabase } from '@/shared/lib/supabase'
import { getProfile, provision } from '@/shared/services/auth'
import useAuth from '@/shared/hooks/useAuth'
import LoadingScreen from '@/shared/components/LoadingScreen'
import PublicShell from '@/shared/components/PublicShell'
import AuthFrame from './AuthFrame'

const INVALID = 'This invite link is invalid or expired.'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session: sess }, error: authError } = await supabase.auth.getSession()
      if (authError) throw authError
      if (!sess?.user) throw new Error(INVALID)
      let current = await getProfile(sess.user.id)
      if (!current) current = await provision({ ...sess.user.user_metadata, email: sess.user.email })
      if (!current?.role) throw new Error(INVALID)
      if (active) { setSession(sess); setProfile(current) }
    })().catch((err) => active && setError(err.message || INVALID))
    return () => { active = false }
  }, [])

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
      await refreshUser(session.user)
      navigate(`/${profile.role}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not set your password. The invite may have expired.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !profile) {
    return (
      <PublicShell>
        <AuthFrame title="Invite link issue." subtitle="We couldn’t open this invitation.">
          <div className="flex flex-col gap-5">
            <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>
            <Link to="/portals" className="text-xs font-medium text-primary">Go to sign in</Link>
          </div>
        </AuthFrame>
      </PublicShell>
    )
  }

  if (!profile) return <LoadingScreen />

  return (
    <PublicShell>
      <AuthFrame title="Set your password." subtitle="Your invite is ready. Choose a password to activate your account.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-password">New Password</FieldLabel>
              <InputGroup>
                <InputGroupInput id="invite-password" name="password" type="password" autoComplete="new-password" placeholder="Min. 8 characters" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-confirm">Confirm Password</FieldLabel>
              <InputGroup>
                <InputGroupInput id="invite-confirm" name="confirm" type="password" autoComplete="new-password" placeholder="Re-enter password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
      </AuthFrame>
    </PublicShell>
  )
}
