import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { PageHeading, Panel } from './design'
import { LinkButton } from './design'
import useAuth from '../hooks/useAuth'
import { ROLE_LABELS } from '../constants'
import { titleCase } from '../utils/titleCase'

// Equal-height settings cards: the fixed height keeps the grid rows level and
// the body scrolls instead of stretching the card.
const UNIFORM_PANEL = { className: 'h-[26rem]', contentClassName: 'min-h-0 flex-1 overflow-y-auto' }

export function PrivacyPanel({ className, contentClassName }) {
  return (
    <Panel id="privacy" title="Privacy comes first" action={<ShieldCheck className="size-5 text-teal" />} className={className} contentClassName={contentClassName}>
      <p className="text-xs leading-6 text-muted-foreground">
        Review what JobLinked processes and who can access it.
      </p>
      <div className="mt-4 flex flex-col">
        <Link className="text-link text-xs" to="/privacy">Read the full Privacy Notice</Link>
        <Link className="text-link text-xs" to="/terms">Review the Terms of Use</Link>
      </div>
    </Panel>
  )
}

export default function AccountSettings({ embedded = false, children, childrenBelow = false, showPrivacy = true, uniform = false }) {
  const { user } = useAuth() || {}
  const [updates, setUpdates] = useState(true)
  const [announcements, setAnnouncements] = useState(true)
  const [saved, setSaved] = useState(false)
  const isAdmin = user?.role === 'super-admin'
  const profilePath = user?.role === 'employer' ? '/employer/company' : '/job-seeker/profile'
  const PreferencesForm = embedded ? 'div' : 'form'
  const accountOverviewPanel = (panelProps) => (
    <Panel id="account-overview" title="Account overview" description="Your JobLinked account details." {...panelProps}>
      <dl className="grid grid-cols-[100px_1fr] gap-4 text-xs">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="font-medium">{titleCase(user?.full_name || user?.name) || '—'}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{user?.email || '—'}</dd>
        <dt className="text-muted-foreground">Workspace</dt>
        <dd>{ROLE_LABELS[user?.role] || '—'}</dd>
      </dl>
      {!embedded && !isAdmin && (
        <LinkButton href={profilePath} variant="outline" className="mt-5">
          Edit {user?.role === 'employer' ? 'company' : 'my'} profile
        </LinkButton>
      )}
    </Panel>
  )
  const notificationsPanel = (panelProps) => (
    <Panel id="notification-preferences" title="Notifications" description="Preferences apply to your JobLinked account." {...panelProps}>
      <PreferencesForm onSubmit={embedded ? undefined : (event) => { event.preventDefault(); setSaved(true) }}>
        <FieldGroup>
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="application-updates">Application & recruitment updates</FieldLabel>
              <FieldDescription>Application, interview, and accreditation notices.</FieldDescription>
            </Field>
            <Switch id="application-updates" checked={updates} onCheckedChange={setUpdates} />
          </Field>
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="community-notices">Community announcements</FieldLabel>
              <FieldDescription>PESO programs and employment notices.</FieldDescription>
            </Field>
            <Switch id="community-notices" checked={announcements} onCheckedChange={setAnnouncements} />
          </Field>
          <Button type={embedded ? 'button' : 'submit'} onClick={embedded ? () => setSaved(true) : undefined}>
            <Save data-icon="inline-start" />
            Save preferences
          </Button>
          {saved && <p role="status" className="text-xs text-success">Your session notification preferences were saved.</p>}
        </FieldGroup>
      </PreferencesForm>
    </Panel>
  )

  return (
    <>
      {!embedded && (
        <PageHeading
          eyebrow="Make yourself at home"
          title={isAdmin ? 'Workspace & system settings' : 'Your account, your preferences.'}
          description="Manage your account, notification preferences, privacy, and the reference values used across JobLinked."
        />
      )}
      {uniform ? (
        <section aria-labelledby="account-preferences-heading">
          <div className="mb-4">
            <h2 id="account-preferences-heading" className="text-lg font-semibold tracking-tight text-navy">Account &amp; preferences</h2>
            <p className="mt-1 text-xs text-muted-foreground">Your details, notification preferences, and privacy information.</p>
          </div>
          <div className="grid items-stretch gap-6 sm:grid-cols-2">
            {!embedded && notificationsPanel(UNIFORM_PANEL)}
            {!embedded && showPrivacy && <PrivacyPanel {...UNIFORM_PANEL} />}
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div className="flex min-w-0 flex-col gap-6">
            {accountOverviewPanel()}
            {embedded ? notificationsPanel() : showPrivacy && <PrivacyPanel />}
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {!embedded && notificationsPanel()}
            {!childrenBelow && children}
          </div>
        </div>
      )}
      {childrenBelow && <div className="mt-8">{children}</div>}
    </>
  )
}
