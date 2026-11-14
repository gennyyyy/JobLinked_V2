import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { PageHeading, Panel, TextField } from './design'
import { LinkButton } from './design'
import useAuth from '../hooks/useAuth'
import { ROLE_LABELS } from '../constants'
import { titleCase } from '../utils/titleCase'
import { getPreferences, updatePreferences } from '../services/account'
import { changeEmail } from '../services/auth'
import * as authService from '../services/auth'

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
  const [prefs, setPrefs] = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [prefsError, setPrefsError] = useState('')
  const [savedPrefs, setSavedPrefs] = useState(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')
  const [prefsSaveError, setPrefsSaveError] = useState('')
  const [emailForm, setEmailForm] = useState({ current: '', newEmail: '' })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [mfaFactors, setMfaFactors] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaError, setMfaError] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [enrollData, setEnrollData] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyingMfa, setVerifyingMfa] = useState(false)
  const [disablingMfaId, setDisablingMfaId] = useState(null)
  const [disableCode, setDisableCode] = useState('')

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

  useEffect(() => {
    if (embedded) {
      queueMicrotask(() => {
        setMfaFactors([])
        setMfaLoading(false)
      })
      return
    }
    let cancelled = false
    async function load() {
      let listFactors
      try { listFactors = authService.listMfaFactors } catch { listFactors = undefined }
      if (typeof listFactors !== 'function') {
        if (!cancelled) { setMfaFactors([]); setMfaLoading(false) }
        return
      }
      try {
        const factors = await listFactors()
        if (cancelled) return
        setMfaFactors(Array.isArray(factors) ? factors : [])
      } catch (err) {
        if (cancelled) return
        setMfaFactors([])
        setMfaError(err?.message || 'Failed to load two-factor authentication.')
      } finally {
        if (!cancelled) setMfaLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [embedded])

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

  async function handleChangeEmail(event) {
    event?.preventDefault?.()
    setEmailMessage('')
    setEmailError('')
    if (!emailForm.current) {
      setEmailError('Enter your current password.')
      return
    }
    if (!emailForm.newEmail) {
      setEmailError('Enter a new email address.')
      return
    }
    setEmailSaving(true)
    try {
      await changeEmail(emailForm.newEmail, emailForm.current)
      setEmailForm({ current: '', newEmail: '' })
      setEmailMessage('Check your inbox to confirm the new address.')
    } catch (err) {
      setEmailError(err?.message || 'Failed to update email.')
    } finally {
      setEmailSaving(false)
    }
  }

  const enrolledMfaFactors = (mfaFactors || []).filter((factor) => !factor?.status || factor.status === 'verified')

  async function handleEnrollMfa() {
    setMfaError('')
    setMfaMessage('')
    let enroll
    try { enroll = authService.enrollMfa } catch { enroll = undefined }
    if (typeof enroll !== 'function') return
    try {
      const data = await enroll()
      setEnrollData(data)
    } catch (err) {
      setMfaError(err?.message || 'Failed to start enrollment.')
    }
  }

  async function handleVerifyMfa() {
    if (!enrollData?.id) return
    setVerifyingMfa(true)
    setMfaError('')
    setMfaMessage('')
    try {
      let verify
      try { verify = authService.verifyMfaEnrollment } catch { verify = undefined }
      if (typeof verify !== 'function') return
      await verify(enrollData.id, verifyCode)
      setEnrollData(null)
      setVerifyCode('')
      setMfaMessage('Two-factor authentication enabled.')
      let listFactors
      try { listFactors = authService.listMfaFactors } catch { listFactors = undefined }
      if (typeof listFactors === 'function') {
        const factors = await listFactors()
        setMfaFactors(Array.isArray(factors) ? factors : [])
      }
    } catch (err) {
      setMfaError(err?.message || 'Invalid code.')
    } finally {
      setVerifyingMfa(false)
    }
  }

  async function handleDisableMfa(factorId) {
    setMfaError('')
    setMfaMessage('')
    let unenroll
    try { unenroll = authService.unenrollMfa } catch { unenroll = undefined }
    if (typeof unenroll !== 'function') return
    try {
      await unenroll(factorId, disableCode)
      setDisablingMfaId(null)
      setDisableCode('')
      setMfaMessage('Two-factor authentication disabled.')
      let listFactors
      try { listFactors = authService.listMfaFactors } catch { listFactors = undefined }
      if (typeof listFactors === 'function') {
        const factors = await listFactors()
        setMfaFactors(Array.isArray(factors) ? factors : [])
      }
    } catch (err) {
      setMfaError(err?.message || 'Invalid code.')
    }
  }

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
      <PreferencesForm onSubmit={embedded ? undefined : handleSavePrefs}>
        <FieldGroup>
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
          <Button type={embedded ? 'button' : 'submit'} disabled={!dirty || savingPrefs || loadingPrefs} onClick={embedded ? handleSavePrefs : undefined}>
            <Save data-icon="inline-start" />
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </Button>
          {prefsMessage && <p role="status" className="text-xs text-success">{prefsMessage}</p>}
          {prefsSaveError && <p role="alert" className="text-xs text-destructive">{prefsSaveError}</p>}
        </FieldGroup>
      </PreferencesForm>
    </Panel>
  )

  const emailPanel = (panelProps) => (
    <Panel id="email-change" title="Change email" description="Update the email address used to sign in." {...panelProps}>
      <form onSubmit={handleChangeEmail} className="flex flex-col gap-5">
        <TextField label="Current password" type="password" autoComplete="current-password" required value={emailForm.current} onChange={(e) => setEmailForm((prev) => ({ ...prev, current: e.target.value }))} />
        <TextField label="New email" type="email" autoComplete="email" required value={emailForm.newEmail} onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))} />
        {emailMessage && <p role="status" className="text-xs text-success">{emailMessage}</p>}
        {emailError && <p role="alert" className="text-xs text-destructive">{emailError}</p>}
        <Button type="submit" disabled={emailSaving}>
          {emailSaving ? 'Updating…' : 'Update email'}
        </Button>
      </form>
    </Panel>
  )

  const mfaPanel = (panelProps) => (
    <Panel id="mfa" title="Two-factor authentication" description="Protect your account with an authenticator app." {...panelProps}>
      {mfaLoading && <p className="text-xs text-muted-foreground">Loading two-factor authentication…</p>}
      {mfaError && <p role="alert" className="text-xs text-destructive">{mfaError}</p>}
      {mfaMessage && <p role="status" className="text-xs text-success">{mfaMessage}</p>}
      {!mfaLoading && enrolledMfaFactors.length === 0 && !enrollData && (
        <Button type="button" onClick={handleEnrollMfa}>Enable two-factor authentication</Button>
      )}
      {enrollData && (
        <div className="flex flex-col gap-4">
          <img src={enrollData?.totp?.qr_code} alt="QR code" className="size-40" />
          {enrollData?.totp?.secret && (
            <p className="text-xs text-muted-foreground">Secret: <code>{enrollData.totp.secret}</code></p>
          )}
          <input
            aria-label="Verification code"
            placeholder="Enter code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className="form-input"
          />
          <Button type="button" disabled={verifyingMfa} onClick={handleVerifyMfa}>
            {verifyingMfa ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
      )}
      {enrolledMfaFactors.length > 0 && (
        <ul className="flex flex-col gap-3">
          {enrolledMfaFactors.map((factor) => (
            <li key={factor.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{factor.friendly_name || 'Authenticator app'}</span>
                {disablingMfaId !== factor.id && (
                  <Button type="button" variant="outline" onClick={() => setDisablingMfaId(factor.id)}>Disable</Button>
                )}
              </div>
              {disablingMfaId === factor.id && (
                <div className="flex flex-col gap-2">
                  <input
                    aria-label="Verification code"
                    placeholder="Enter code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    className="form-input"
                  />
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => handleDisableMfa(factor.id)}>Confirm disable</Button>
                    <Button type="button" variant="outline" onClick={() => { setDisablingMfaId(null); setDisableCode('') }}>Cancel</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
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
            {!embedded && emailPanel(UNIFORM_PANEL)}
            {!embedded && mfaPanel(UNIFORM_PANEL)}
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
            {!embedded && emailPanel()}
            {!embedded && mfaPanel()}
            {!embedded && notificationsPanel()}
            {!childrenBelow && children}
          </div>
        </div>
      )}
      {childrenBelow && <div className="mt-8">{children}</div>}
    </>
  )
}
