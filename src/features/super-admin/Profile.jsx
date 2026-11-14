import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { revokeAllSessions, deactivateAccount } from '@/shared/services/account'
import ChangePassword from '@/shared/components/ChangePassword'
import { LinkButton, PageHeading, Panel, TextField } from '@/shared/components/design'
import { ROLE_LABELS } from '@/shared/constants'

export default function Profile() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.full_name || user?.name || '')
  const [email] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [revokeMessage, setRevokeMessage] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')

  async function handleSignOutAll() {
    setRevoking(true)
    setRevokeMessage('')
    setRevokeError('')
    try {
      await revokeAllSessions()
      setRevokeMessage('Signed out of all devices.')
    } catch (err) {
      setRevokeError(err?.message || 'Failed to sign out all devices.')
    } finally {
      setRevoking(false)
    }
  }

  async function handleDeactivate() {
    setDeactivating(true)
    setDeactivateError('')
    try {
      await deactivateAccount()
      navigate('/login')
    } catch (err) {
      setDeactivateError(err?.message || 'Failed to deactivate account.')
    } finally {
      setDeactivating(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateProfile(user.id, { full_name: name.trim() })
      await refreshUser(user)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Superadmin account"
        title="Profile management"
        description="Manage the profile details used across the JobLinked administration workspace."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          id="personal-details"
          title="Personal details"
          description="Keep your administrator identity current for workspace activity and audit records."
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
            <TextField label="Email address" type="email" value={email} readOnly help="Login email is managed by Supabase. Use Settings → Security to change it." />            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {saved && <p className="text-xs text-success">Profile saved.</p>}
            <Button type="submit" disabled={saving || !name.trim()}>
              <Save data-icon="inline-start" />
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
          <LinkButton href="/super-admin/settings#security" variant="outline" className="mt-5">Manage security & preferences in Settings</LinkButton>
        </Panel>
        <Panel
          id="administrator-access"
          title="Administrator access"
          description="Your role and access level are managed by the system."
          action={<ShieldCheck className="size-5 text-teal" />}
        >
          <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{ROLE_LABELS['super-admin']}</dd>
            <dt className="text-muted-foreground">Access</dt>
            <dd>Full platform administration</dd>
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="break-all">{user?.id}</dd>
          </dl>
        </Panel>
      </div>
      <div className="mt-6">
        <ChangePassword />
      </div>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <Panel id="sessions" title="Sessions" description="Sign out every active device.">
          <p className="text-xs text-muted-foreground">If you think your account is compromised, revoke all sessions and sign back in.</p>
          <Button type="button" variant="outline" className="mt-4" disabled={revoking} onClick={handleSignOutAll}>
            {revoking ? 'Signing out…' : 'Sign out all devices'}
          </Button>
          {revokeMessage && <p role="status" className="mt-3 text-xs text-success">{revokeMessage}</p>}
          {revokeError && <p role="alert" className="mt-3 text-xs text-destructive">{revokeError}</p>}
        </Panel>
        <Panel id="danger-zone" title="Danger zone" description="Deactivate your account. An administrator can reactivate it later." action={<ShieldCheck className="size-5 text-teal" />}>
          <p className="text-xs text-muted-foreground">Deactivating signs you out of all devices and disables login until an administrator reactivates the account.</p>
          {!confirmDeactivate ? (
            <Button type="button" variant="destructive" className="mt-4" onClick={() => setConfirmDeactivate(true)}>Deactivate account</Button>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" variant="destructive" disabled={deactivating} onClick={handleDeactivate}>{deactivating ? 'Deactivating…' : 'Confirm deactivation'}</Button>
              <Button type="button" variant="outline" disabled={deactivating} onClick={() => setConfirmDeactivate(false)}>Cancel</Button>
            </div>
          )}
          {deactivateError && <p role="alert" className="mt-3 text-xs text-destructive">{deactivateError}</p>}
        </Panel>
      </div>
    </>
  )
}
