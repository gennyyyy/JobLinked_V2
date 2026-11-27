import { useId, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from './design'
import useAuth from '../hooks/useAuth'
import { eraseAccount } from '../services/account'

export function DangerZonePanel({ className, contentClassName, size }) {
  const { user } = useAuth() || {}
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [erasing, setErasing] = useState(false)
  const [eraseError, setEraseError] = useState('')
  const confirmId = useId()
  // ADR-060: erasure is a data-subject action, not a staff one (the server 403s).
  const canErase = user?.role !== 'super-admin'

  async function handleErase(event) {
    event.preventDefault()
    if (confirmText !== 'DELETE' || erasing) return
    setEraseError('')
    setErasing(true)
    try {
      await eraseAccount()
      window.location.assign('/')
    } catch (err) {
      setEraseError(err?.message || 'Failed to delete account.')
    } finally {
      setErasing(false)
    }
  }

  function cancelErase() {
    if (erasing) return
    setDeleteOpen(false)
    setConfirmText('')
    setEraseError('')
  }

  return (
    <Panel id="danger-zone" title="Danger zone" description="Permanently delete your account and personal data." className={className} contentClassName={contentClassName} size={size} action={<ShieldCheck className="size-5 text-teal" />}>
      {canErase && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-destructive">Delete account permanently</p>
          <p className="text-xs text-muted-foreground">
            This erases your personal details, documents, and login. Records PESO must retain by law stay without
            your identifying details. This cannot be undone.
          </p>
          {!deleteOpen ? (
            <Button type="button" variant="destructive" className="mt-2" onClick={() => setDeleteOpen(true)}>
              Delete account permanently
            </Button>
          ) : (
            <form onSubmit={handleErase} className="mt-2 space-y-3">
              <div>
                <label htmlFor={confirmId} className="block text-xs text-muted-foreground">
                  Type DELETE to confirm
                </label>
                <Input
                  id={confirmId}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="mt-1 max-w-56"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="destructive" disabled={confirmText !== 'DELETE' || erasing}>
                  {erasing ? 'Deleting…' : 'Delete account permanently'}
                </Button>
                <Button type="button" variant="outline" disabled={erasing} onClick={cancelErase}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          {eraseError && <p role="alert" className="text-xs text-destructive">{eraseError}</p>}
        </div>
      )}
    </Panel>
  )
}

export default DangerZonePanel;
