import { useEffect, useState } from 'react'
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
import { getPreferences, updatePreferences } from '../services/account'

// Equal-height settings cards: the fixed height keeps the grid rows level and
// the body scrolls instead of stretching the card.
const UNIFORM_PANEL = { className: 'h-[26rem]', contentClassName: 'min-h-0 flex-1 overflow-y-auto', size: 'sm' }

export function PrivacyPanel({ className, contentClassName, size = 'default' }) {
  return (
    <Panel id="privacy" title="Privacy comes first" action={<ShieldCheck className="size-5 text-teal" />} className={className} contentClassName={contentClassName} size={size}>
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
  const [prefs, setPrefs] = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [prefsError, setPrefsError] = useState('')
  const [savedPrefs, setSavedPrefs] = useState(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')
  const [prefsSaveError, setPrefsSaveError] = useState('')


  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingPrefs(true)
        setPrefsError('')
      }
    })
    getPreferences()
      .then((data) => {
        if (cancelled) return
        const next = {
          application_updates: data?.application_updates ?? true,
          community_announcements: data?.community_announcements ?? true,
        }
        setPrefs(next)
        setSavedPrefs(next)
      })
      .catch((err) => {
        if (cancelled) return
        setPrefsError(err?.message || 'Failed to load notification preferences.')
      })
      .finally(() => { if (!cancelled) setLoadingPrefs(false) })
    return () => { cancelled = true }
  }, [user])

  const updates = prefs?.application_updates ?? true
  const announcements = prefs?.community_announcements ?? true
  const dirty = !!prefs && !!savedPrefs
    && (prefs.application_updates !== savedPrefs.application_updates
      || prefs.community_announcements !== savedPrefs.community_announcements)

  async function handleSavePrefs(event) {
    if (event) event.preventDefault()
    if (!prefs || !dirty || savingPrefs) return
    setSavingPrefs(true)
    setPrefsSaveError('')
    setPrefsMessage('')
    const patch = {}
    if (prefs.application_updates !== savedPrefs.application_updates) patch.application_updates = prefs.application_updates
    if (prefs.community_announcements !== savedPrefs.community_announcements) patch.community_announcements = prefs.community_announcements
    try {
      await updatePreferences(patch)
      setSavedPrefs({ ...prefs })
      setPrefsMessage('Your notification preferences were saved.')
    } catch (err) {
      setPrefsSaveError(err?.message || 'Failed to save notification preferences.')
    } finally {
      setSavingPrefs(false)
    }
  }

  function togglePref(key, value) {
    setPrefs((prev) => ({ ...(prev || {}), [key]: value }))
    setPrefsMessage('')
    setPrefsSaveError('')
  }

  const isAdmin = user?.role === 'super-admin'
  const profilePath = user?.role === 'employer' ? '/employer/company' : user?.role === 'super-admin' ? '/super-admin/profile' : '/job-seeker/profile'
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
      <PreferencesForm onSubmit={embedded ? undefined : handleSavePrefs}>
        <FieldGroup className="gap-3">
          {loadingPrefs && <p className="text-xs text-muted-foreground">Loading…</p>}
          {prefsError && <p role="alert" className="text-xs text-destructive">{prefsError}</p>}
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="application-updates">Application & recruitment updates</FieldLabel>
              <FieldDescription>Application, interview, and accreditation notices.</FieldDescription>
            </Field>
            <Switch id="application-updates" checked={updates} disabled={loadingPrefs} onCheckedChange={(v) => togglePref('application_updates', v)} />
          </Field>
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="community-notices">Community announcements</FieldLabel>
              <FieldDescription>PESO programs and employment notices.</FieldDescription>
            </Field>
            <Switch id="community-notices" checked={announcements} disabled={loadingPrefs} onCheckedChange={(v) => togglePref('community_announcements', v)} />
          </Field>
          <div className="mt-3">
            <Button type={embedded ? 'button' : 'submit'} size="sm" disabled={!dirty || savingPrefs || loadingPrefs} onClick={embedded ? handleSavePrefs : undefined}>
              <Save data-icon="inline-start" />
              {savingPrefs ? 'Saving…' : 'Save preferences'}
            </Button>
          </div>
          {prefsMessage && <p role="status" className="text-xs text-success">{prefsMessage}</p>}
          {prefsSaveError && <p role="alert" className="text-xs text-destructive">{prefsSaveError}</p>}
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
          <div className="mb-3">
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
      {childrenBelow && <div className="mt-4">{children}</div>}
    </>
  )
}
