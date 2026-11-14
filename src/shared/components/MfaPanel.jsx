import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Panel } from './design'
import useAuth from '../hooks/useAuth'
import * as authService from '../services/auth'

export function MfaPanel({ className, contentClassName, size }) {
  const { user } = useAuth() || {}
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
  }, [user])

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

  return (
    <Panel id="mfa" title="Two-factor authentication" description="Protect your account with an authenticator app." className={className} contentClassName={contentClassName} size={size}>
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
}

export default MfaPanel;