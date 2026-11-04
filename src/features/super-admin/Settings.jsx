import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { listReferenceData, addReferenceData, removeReferenceData } from '@/shared/services/admin'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import { PanelSkeleton } from '@/shared/components/Skeletons'
import { InlineError, SectionCard } from '@/shared/components/dashboard'
import { Notice, PageHeading, Panel } from '@/shared/components/design'
import useAuth from '@/shared/hooks/useAuth'
import { ROLE_LABELS } from '@/shared/constants'

const categoryLabels = { employment_type: 'Employment Types', education_level: 'Education Levels' }

export default function Settings() {
  const { user } = useAuth() || {}
  const [updates, setUpdates] = useState(true)
  const [announcements, setAnnouncements] = useState(true)
  const [saved, setSaved] = useState(false)
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newValues, setNewValues] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    Promise.all(Object.keys(categoryLabels).map((category) => listReferenceData(category)))
      .then(([employment, education]) => setCategories({ employment_type: employment, education_level: education }))
      .catch((err) => setError(err.message || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAddCategory(category) {
    const value = (newValues[category] || '').trim()
    if (!value) return
    await addReferenceData(category, value)
    const updated = await listReferenceData(category)
    setCategories((prev) => ({ ...prev, [category]: updated }))
    setNewValues((prev) => ({ ...prev, [category]: '' }))
  }

  async function handleRemoveCategory(category, id) {
    await removeReferenceData(id)
    const updated = await listReferenceData(category)
    setCategories((prev) => ({ ...prev, [category]: updated }))
    setConfirmDelete(null)
  }

  return (
    <>
      <PageHeading
        eyebrow="Make yourself at home"
        title="Workspace & system settings"
        description="Review your sample account, notification preferences, and privacy information."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Account overview" description="This is a fictional demo identity, not a production account.">
            <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user?.full_name || user?.name || '—'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{user?.email || '—'}</dd>
              <dt className="text-muted-foreground">Workspace</dt>
              <dd>{ROLE_LABELS['super-admin']}</dd>
            </dl>
          </Panel>
          <Panel title="Notifications" description="Preferences apply only to your current demo account.">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setSaved(true)
              }}
            >
              <FieldGroup>
                <Field orientation="horizontal">
                  <Field>
                    <FieldLabel htmlFor="application-updates">Application & recruitment updates</FieldLabel>
                    <FieldDescription>Sample application, interview, and accreditation notices.</FieldDescription>
                  </Field>
                  <Switch id="application-updates" checked={updates} onCheckedChange={setUpdates} />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <FieldLabel htmlFor="community-notices">Community announcements</FieldLabel>
                    <FieldDescription>Sample PESO programs and employment notices.</FieldDescription>
                  </Field>
                  <Switch id="community-notices" checked={announcements} onCheckedChange={setAnnouncements} />
                </Field>
                <Button type="submit">
                  <Save data-icon="inline-start" />
                  Save preferences
                </Button>
                {saved && <p className="text-xs text-success">Your session notification preferences were saved.</p>}
              </FieldGroup>
            </form>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Privacy comes first" action={<ShieldCheck className="size-5 text-teal" />}>
            <p className="text-xs leading-6 text-muted-foreground">
              Review what a future production service would process and who could access it. These configurable drafts require organizational and legal review.
            </p>
            <div className="mt-4 flex flex-col">
              <Link className="text-link text-xs" to="/privacy">Read the full Privacy Notice</Link>
              <Link className="text-link text-xs" to="/terms">Review the demo Terms</Link>
            </div>
          </Panel>
          <Notice title="A preview, not production auth">
            Frontend role guards are for demonstration only. Password hashing, server-side authorization, secure sessions, and account deletion belong to the future Express backend.
          </Notice>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <h2 className="text-base font-semibold text-navy">Reference values</h2>
        {loading ? (
          <PanelSkeleton lines={4} />
        ) : error ? (
          <InlineError message={error} />
        ) : (
          Object.entries(categoryLabels).map(([category, label]) => (
            <SectionCard key={category} title={label} subtitle="Reference values available across the workspace.">
              <ul className="flex flex-col divide-y">
                {(categories[category] || []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <span className="text-xs font-medium text-navy">{item.value}</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ category, id: item.id, value: item.value })} className="text-destructive">
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <form onSubmit={(event) => { event.preventDefault(); handleAddCategory(category) }} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Input
                  type="text"
                  value={newValues[category] || ''}
                  onChange={(e) => setNewValues((prev) => ({ ...prev, [category]: e.target.value }))}
                  placeholder={`Add ${label.toLowerCase().replace(/s$/, '')}...`}
                  aria-label={`Add ${label.toLowerCase().replace(/s$/, '')}`}
                  className="flex-1"
                />
                <Button type="submit"><Plus data-icon="inline-start" />Add</Button>
              </form>
            </SectionCard>
          ))
        )}
      </div>
      {confirmDelete && (
        <ConfirmationModal
          message={`Remove "${confirmDelete.value}"?`}
          onConfirm={() => handleRemoveCategory(confirmDelete.category, confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          confirmLabel="Remove"
          danger
        />
      )}
    </>
  )
}
