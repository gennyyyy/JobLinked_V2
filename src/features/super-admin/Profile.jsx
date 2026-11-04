import { useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import ChangePassword from '@/shared/components/ChangePassword'
import { PageHeading, Panel, TextField } from '@/shared/components/design'
import { ROLE_LABELS } from '@/shared/constants'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.full_name || user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

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
          title="Personal details"
          description="Keep your administrator identity current for workspace activity and audit records."
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
            <TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {saved && <p className="text-xs text-success">Profile saved.</p>}
            <Button type="submit" disabled={saving || !name.trim() || !email.trim()}>
              <Save data-icon="inline-start" />
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
        </Panel>
        <Panel
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
    </>
  )
}
