import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { PageHeading, Panel } from './design'
import { LinkButton } from './design'
import DangerZonePanel from './DangerZonePanel'
import useAuth from '../hooks/useAuth'
import { ROLE_LABELS } from '../constants'
import { titleCase } from '../utils/titleCase'
import { exportAccount, getPreferences, updatePreferences } from '../services/account'

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

export default function AccountSettings({ embedded = false, children, childrenBelow = false, showPrivacy = true, uniform = false, aside }) {
  const { user } = useAuth() || {}
  const [prefs, setPrefs] = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [prefsError, setPrefsError] = useState('')
  const [savedPrefs, setSavedPrefs] = useState(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')
  const [prefsSaveError, setPrefsSaveError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [exportError, setExportError] = useState('')


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

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    setExportError('')
    try {
      await exportAccount()
      setExportMessage('Your data export was downloaded.')
    } catch (err) {
      setExportError(err?.message || 'Failed to export your data.')
    } finally {
      setExporting(false)
    }
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
      {!isAdmin && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!embedded && (
            <LinkButton href={profilePath} variant="outline">
              Edit {user?.role === 'employer' ? 'company' : 'my'} profile
            </LinkButton>
          )}
          <Button type="button" variant="outline" disabled={exporting} onClick={handleExport}>
            <Download data-icon="inline-start" />
            {exporting ? 'Preparing export…' : 'Export my data'}
          </Button>
        </div>
      )}
      {exportMessage && <p role="status" className="mt-3 text-xs text-success">{exportMessage}</p>}
      {exportError && <p role="alert" className="mt-3 text-xs text-destructive">{exportError}</p>}
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
              <FieldLabel htmlFor="application-updates">Application &amp; Recruitment Updates</FieldLabel>
              <FieldDescription>Application, interview, and accreditation notices.</FieldDescription>
            </Field>
            <Switch id="application-updates" checked={updates} disabled={loadingPrefs} onCheckedChange={(v) => togglePref('application_updates', v)} />
          </Field>
          <Field orientation="horizontal">
            <Field>
              <FieldLabel htmlFor="community-notices">Community Announcements</FieldLabel>
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
          title={isAdmin ? 'System settings' : 'Your account, your preferences.'}
          description="Configure the reference values and legal documents that power the platform."
        />
      )}
      {uniform ? (
        showPrivacy ? (
          <section aria-labelledby="account-preferences-heading">
            <div className="mb-3">
              <h2 id="account-preferences-heading" className="text-lg font-semibold tracking-tight text-navy">Account &amp; preferences</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your details, notification preferences, and privacy information.</p>
            </div>
            <div className="max-w-md">
              <PrivacyPanel {...UNIFORM_PANEL} />
            </div>
          </section>
        ) : null
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr] xl:grid-rows-[auto_auto_auto]">
          <div className="flex min-w-0 flex-col gap-6 xl:row-span-3 xl:grid xl:grid-rows-subgrid xl:items-start">
            {accountOverviewPanel()}
            {embedded ? notificationsPanel() : showPrivacy && <PrivacyPanel />}
            {aside}
          </div>
          <div className={`flex min-w-0 flex-col gap-6 xl:row-span-3 xl:grid xl:grid-rows-subgrid xl:items-start${embedded ? ' xl:[&>*:first-child]:row-span-2' : ''}`}>
            {!embedded && notificationsPanel()}
            {!childrenBelow && children}
          </div>
          {user?.role && user?.role !== 'super-admin' && (
            <div className="min-w-0 xl:col-span-2">
              <DangerZonePanel />
            </div>
          )}
        </div>
      )}
      {childrenBelow && <div className="mt-4">{children}</div>}
    </>
  )
}
