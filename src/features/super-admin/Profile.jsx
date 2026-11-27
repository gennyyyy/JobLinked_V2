import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { TabsContent } from '@/components/ui/tabs'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import ChangePassword from '@/shared/components/ChangePassword'
import AccountSettings, { PrivacyPanel } from '@/shared/components/AccountSettings'
import MfaPanel from '@/shared/components/MfaPanel'
import SessionsPanel from '@/shared/components/SessionsPanel'
import TabbedProfileLayout from '@/shared/components/TabbedProfileLayout'
import { Panel, TextField } from '@/shared/components/design'
import { ROLE_LABELS } from '@/shared/constants'
import { nameChangeLockHelp } from '@/shared/utils/names'

const PROFILE_TABS = [
  { value: 'account', label: 'Personal', title: 'Account details', description: 'Your profile information and administrator access.' },
  { value: 'security', label: 'Account settings', title: 'Security & access', description: 'Password, sessions, and multi-factor authentication.' },
]

export default function Profile() {
  const { user, refreshUser } = useAuth() || {}
  const [activeTab, setActiveTab] = useState('account')
  const [name, setName] = useState(user?.full_name || user?.name || '')
  // ADR-058: the full name locks while the account's 30-day window is open.
  const nameLockHelp = nameChangeLockHelp(user?.name_changed_at)
  const [email] = useState(user?.email || '')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)


  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError('Enter your full name.')
      return
    }
    setNameError('')
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
            <TextField
              label="Full Name"
              required
              value={name}
              error={nameError}
              disabled={Boolean(nameLockHelp)}
              help={nameLockHelp || undefined}
              onChange={(event) => { setName(event.target.value); setNameError('') }}
            />
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
        <AccountSettings
          embedded
          showPrivacy={false}
          aside={<SessionsPanel />}
        >
          <ChangePassword embedded />
          <MfaPanel />
        </AccountSettings>
      </TabsContent>
    </TabbedProfileLayout>
  )
}
