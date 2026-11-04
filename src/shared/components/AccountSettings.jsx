import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Notice, PageHeading, Panel } from './design'
import { LinkButton } from './design'
import useAuth from '../hooks/useAuth'
import { ROLE_LABELS } from '../constants'

export default function AccountSettings() {
  const { user } = useAuth() || {}
  const [updates, setUpdates] = useState(true)
  const [announcements, setAnnouncements] = useState(true)
  const [saved, setSaved] = useState(false)
  const isAdmin = user?.role === 'super-admin'
  const profilePath = user?.role === 'employer' ? '/employer/company' : '/job-seeker/profile'

  return (
    <>
      <PageHeading
        eyebrow="Make yourself at home"
        title={isAdmin ? 'Workspace & system settings' : 'Your account, your preferences.'}
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
              <dd>{ROLE_LABELS[user?.role] || '—'}</dd>
            </dl>
            {!isAdmin && (
              <LinkButton href={profilePath} variant="outline" className="mt-5">
                Edit {user?.role === 'employer' ? 'company' : 'my'} profile
              </LinkButton>
            )}
          </Panel>
          <Panel title="Notifications" description="Preferences apply only to your current demo account.">
            <form onSubmit={(event) => { event.preventDefault(); setSaved(true) }}>
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
    </>
  )
}
