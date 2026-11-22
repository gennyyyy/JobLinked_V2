import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { revokeAllSessions } from '@/shared/services/account'
import ChangePassword from '@/shared/components/ChangePassword'
import { PrivacyPanel } from '@/shared/components/AccountSettings'
import MfaPanel from '@/shared/components/MfaPanel'
import DangerZonePanel from '@/shared/components/DangerZonePanel'
import TabbedProfileLayout from '@/shared/components/TabbedProfileLayout'
import { Panel, TextField } from '@/shared/components/design'
import { ROLE_LABELS } from '@/shared/constants'

const PROFILE_TABS = [
  { value: 'account', label: 'Account', title: 'Account details', description: 'Your profile information and administrator access.' },
  { value: 'security', label: 'Security', title: 'Security & access', description: 'Password, sessions, and account deactivation.' },
]

export default function Profile() {
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
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full Name" required value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Email Address" type="email" value={email} readOnly />
          </div>
          <Panel id="administrator-access" title="Administrator access" description="Your role and access level are managed by the system." action={<ShieldCheck className="size-5 text-teal" />} size="sm">
            <dl className="grid grid-cols-[100px_1fr] gap-3 text-xs">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{ROLE_LABELS['super-admin']}</dd>
              <dt className="text-muted-foreground">Access</dt>
              <dd>Full platform administration</dd>
              <dt className="text-muted-foreground">Account ID</dt>
              <dd className="break-all">{user?.id}</dd>
            </dl>
          </Panel>

        </div>
      </TabsContent>
      <TabsContent value="security" id="security" keepMounted>
        <div className="flex flex-col gap-4">
          <ChangePassword embedded />
          <div className="grid items-start gap-4 md:grid-cols-2">
            <MfaPanel />
            <Panel id="sessions" title="Sessions" description="Sign out every active device.">
              <p className="text-xs text-muted-foreground">If you think your account is compromised, revoke all sessions and sign back in.</p>
              <Button type="button" variant="outline" className="mt-3" disabled={revoking} onClick={handleSignOutAll}>
                {revoking ? 'Signing out…' : 'Sign out all devices'}
              </Button>
              {revokeMessage && <p role="status" className="mt-3 text-xs text-success">{revokeMessage}</p>}
              {revokeError && <p role="alert" className="mt-3 text-xs text-destructive">{revokeError}</p>}
            </Panel>
            <DangerZonePanel />
          </div>
        </div>
      </TabsContent>
    </TabbedProfileLayout>
  )
}
