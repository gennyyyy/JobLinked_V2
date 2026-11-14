import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TextField, Panel } from './design'
import useAuth from '../hooks/useAuth'
import { changeEmail } from '../services/auth'

export function EmailChangePanel({ className, contentClassName, size }) {
  const { user } = useAuth() || {}
  const [emailForm, setEmailForm] = useState({ current: '', newEmail: '' })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailError, setEmailError] = useState('')

  const profilePath = user?.role === 'employer' ? '/employer/company' : user?.role === 'super-admin' ? '/super-admin/profile' : '/job-seeker/profile'

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

  return (
    <Panel id="email-change" title="Change email" description="Update the email address used to sign in." className={className} contentClassName={contentClassName} size={size}>
      <form onSubmit={handleChangeEmail} className="flex flex-col gap-5">
        <TextField label="Current password" type="password" autoComplete="current-password" required value={emailForm.current} onChange={(e) => setEmailForm((prev) => ({ ...prev, current: e.target.value }))} />
        <TextField label="New email" type="email" autoComplete="email" required value={emailForm.newEmail} onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))} />
        {emailMessage && <p role="status" className="text-xs text-success">{emailMessage}</p>}
        {emailError && <p role="alert" className="text-xs text-destructive">{emailError}</p>}
        <Button type="submit" disabled={emailSaving}>
          {emailSaving ? 'Updating…' : 'Update email'}
        </Button>
      </form>
      <Link className="text-link text-xs" to={profilePath}>Edit profile details</Link>
    </Panel>
  )
}

export default EmailChangePanel;