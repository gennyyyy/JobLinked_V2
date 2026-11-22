import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Panel, TextField } from './design'
import useAuth from '../hooks/useAuth'
import * as authService from '../services/auth'

// BA answers a `totpURI`, not a QR image: render the QR here and pull the secret
// out for manual entry. A malformed URI simply hides the secret line.
function totpSecret(uri) {
  try {
    return new URL(uri).searchParams.get('secret') || ''
  } catch {
    return ''
  }
}

export function MfaPanel({ className, contentClassName, size }) {
  const { user } = useAuth() || {}
  const [mfaFactors, setMfaFactors] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaError, setMfaError] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [enrollPassword, setEnrollPassword] = useState('')
  const [enrollingMfa, setEnrollingMfa] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyingMfa, setVerifyingMfa] = useState(false)
  const [codesCopied, setCodesCopied] = useState(false)
  const [disablingMfaId, setDisablingMfaId] = useState(null)
  const [disablePassword, setDisablePassword] = useState('')
  const [disablingMfa, setDisablingMfa] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const factors = await authService.listMfaFactors()
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
  }, [user])

  async function refreshFactors() {
    const factors = await authService.listMfaFactors()
    setMfaFactors(Array.isArray(factors) ? factors : [])
  }

  const enrolledMfaFactors = (mfaFactors || []).filter((factor) => !factor?.status || factor.status === 'verified')
  const secret = enrollData ? totpSecret(enrollData.totpURI) : ''

  async function handleEnrollMfa() {
    setMfaError('')
    setMfaMessage('')
    if (!enrollPassword) {
      setMfaError('Enter your current password.')
      return
    }
    setEnrollingMfa(true)
    try {
      const data = await authService.enrollMfa(enrollPassword)
      setEnrollData(data)
      setEnrollPassword('')
      setCodesCopied(false)
    } catch (err) {
      setMfaError(err?.message || 'Failed to start enrollment.')
    } finally {
      setEnrollingMfa(false)
    }
  }

  async function handleCopyCodes() {
    try {
      await navigator.clipboard.writeText((enrollData?.backupCodes || []).join('\n'))
      setCodesCopied(true)
    } catch {
      setMfaError('Copy failed. Select the codes and copy them manually.')
    }
  }

  async function handleVerifyMfa() {
    if (!enrollData) return
    setVerifyingMfa(true)
    setMfaError('')
    setMfaMessage('')
    try {
      await authService.verifyMfaEnrollment(verifyCode)
      // The codes were shown once: the verified state drops them.
      setEnrollData(null)
      setVerifyCode('')
      setMfaMessage('Two-factor authentication enabled.')
      await refreshFactors()
    } catch (err) {
      setMfaError(err?.message || 'Invalid code.')
    } finally {
      setVerifyingMfa(false)
    }
  }

  async function handleDisableMfa() {
    setMfaError('')
    setMfaMessage('')
    if (!disablePassword) {
      setMfaError('Enter your current password.')
      return
    }
    setDisablingMfa(true)
    try {
      await authService.unenrollMfa(disablePassword)
      setDisablingMfaId(null)
      setDisablePassword('')
      setMfaMessage('Two-factor authentication disabled.')
      await refreshFactors()
    } catch (err) {
      setMfaError(err?.message || 'Failed to disable two-factor authentication.')
    } finally {
      setDisablingMfa(false)
    }
  }

  return (
    <Panel id="mfa" title="Two-factor authentication" description="Protect your account with an authenticator app." className={className} contentClassName={contentClassName} size={size}>
      {mfaLoading && <p className="text-xs text-muted-foreground">Loading two-factor authentication…</p>}
      {mfaError && <p role="alert" className="text-xs text-destructive">{mfaError}</p>}
      {mfaMessage && <p role="status" className="text-xs text-success">{mfaMessage}</p>}
      {!mfaLoading && enrolledMfaFactors.length === 0 && !enrollData && (
        <div className="flex flex-col gap-4">
          <TextField
            label="Current Password"
            type="password"
            autoComplete="current-password"
            required
            value={enrollPassword}
            onChange={(e) => setEnrollPassword(e.target.value)}
          />
          <Button type="button" onClick={handleEnrollMfa} disabled={enrollingMfa}>
            {enrollingMfa ? 'Starting…' : 'Enable two-factor authentication'}
          </Button>
        </div>
      )}
      {enrollData && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <QRCodeSVG value={enrollData.totpURI} size={160} aria-label="QR code for your authenticator app" />
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p>Scan the QR with your authenticator app.</p>
              {secret && <p>Or enter the secret: <code className="break-all text-foreground">{secret}</code></p>}
            </div>
          </div>
          {Array.isArray(enrollData.backupCodes) && enrollData.backupCodes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground">Backup codes — save these now; they are shown only once.</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-xs text-muted-foreground">
                {enrollData.backupCodes.map((code) => <li key={code}>{code}</li>)}
              </ul>
              <Button type="button" variant="outline" onClick={handleCopyCodes}>Copy backup codes</Button>
              {codesCopied && <p role="status" className="text-xs text-success">Backup codes copied.</p>}
            </div>
          )}
          <TextField
            label="Verification Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
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
                  <TextField
                    label="Current Password"
                    type="password"
                    autoComplete="current-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="button" disabled={disablingMfa} onClick={handleDisableMfa}>
                      {disablingMfa ? 'Disabling…' : 'Confirm disable'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setDisablingMfaId(null); setDisablePassword('') }}>Cancel</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default MfaPanel;
