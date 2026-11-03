import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import ChangePassword from '@/shared/components/ChangePassword'
import { SectionCard } from '@/shared/components/dashboard'
import { PageHeading, StatusBadge, TextField } from '@/shared/components/design'

function Profile() {
  const { user, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ firstName: user?.first_name || '', lastName: user?.last_name || '' })

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateProfile(user.id, { first_name: form.firstName, last_name: form.lastName, full_name: `${form.firstName} ${form.lastName}`.trim() })
      await refreshUser(user)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.full_name || 'Super Administrator'

  return (
    <>
      <PageHeading
        eyebrow="Superadmin account"
        title={fullName}
        description={user?.email ? `Signed in as ${user.email}.` : 'Manage the details used across the administration workspace.'}
        action={!editing ? (
          <Button variant="outline" type="button" onClick={() => setEditing(true)}>Edit Profile</Button>
        ) : undefined}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <SectionCard title="Personal details" subtitle="Keep your administrator identity current for workspace activity and audit records.">
          {editing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <TextField
                id="profile-first-name"
                label="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="First name"
              />
              <TextField
                id="profile-last-name"
                label="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Last name"
              />
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  <Save data-icon="inline-start" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <>
              {error && <p role="alert" className="mb-4 text-xs text-destructive">{error}</p>}
              <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="mt-1 font-medium text-navy">{fullName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="mt-1 break-all font-medium text-navy">{user?.email || '—'}</dd>
                </div>
              </dl>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Administrator access"
          subtitle="Your role and access level are managed by the system."
          action={<ShieldCheck className="size-5 text-teal" aria-hidden="true" />}
        >
          <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-navy">Super Administrator</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd><StatusBadge status={user?.status || 'Active'} /></dd>
          </dl>
        </SectionCard>
      </div>

      <div className="mt-6">
        <ChangePassword />
      </div>
    </>
  )
}

export default Profile
