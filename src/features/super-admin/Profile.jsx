import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { revokeAllSessions, deactivateAccount } from '@/shared/services/account'
import ChangePassword from '@/shared/components/ChangePassword'
import { PrivacyPanel } from '@/shared/components/AccountSettings'
import TabbedProfileLayout from '@/shared/components/TabbedProfileLayout'
import { LinkButton, Panel, TextField } from '@/shared/components/design'
import { ROLE_LABELS } from '@/shared/constants'

const PROFILE_TABS = [
  { value: 'account', label: 'Account', title: 'Account details', description: 'Your profile information and administrator access.' },
  { value: 'security', label: 'Security', title: 'Security & access', description: 'Password, sessions, and account deactivation.' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth() || {}
  const [activeTab, setActiveTab] = useState('account')
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
    <TabbedProfileLayout
      pageTitle="Profile management"
      pageDescription="Manage the profile details used across the JobLinked administration workspace."
      tabs={PROFILE_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSubmit={handleSubmit}
      saving={saving}
      saveLabel="Save profile"
      savingLabel="Saving…"
      showSave={activeTab === 'account'}
      saveHint={saved ? 'Profile saved.' : 'Changes are saved to your JobLinked account.'}
      status={saved ? 'Profile saved.' : ''}
      error={error}
      sidebar={<PrivacyPanel />}
    >
      <TabsContent value="account" id="personal-details">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Full name" required value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Email address" type="email" value={email} readOnly />
          </div>
          <Panel id="administrator-access" title="Administrator access" description="Your role and access level are managed by the system." action={<ShieldCheck className="size-5 text-teal" />}>
            <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{ROLE_LABELS['super-admin']}</dd>
              <dt className="text-muted-foreground">Access</dt>
              <dd>Full platform administration</dd>
              <dt className="text-muted-foreground">Account ID</dt>
              <dd className="break-all">{user?.id}</dd>
            </dl>
          </Panel>
          <LinkButton href="/super-admin/settings" variant="outline" className="mt-5">
            Manage security & preferences in Settings
          </LinkButton>
        </div>
      </TabsContent>
      <TabsContent value="security" id="security" keepMounted>
        <div className="flex flex-col gap-5">
          <ChangePassword embedded />
          <div className="grid items-start gap-6 md:grid-cols-2">
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
        </div>
      </TabsContent>
    </TabbedProfileLayout>
  )
}
