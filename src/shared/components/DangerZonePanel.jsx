import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from './design'
import { deactivateAccount } from '../services/account'

export function DangerZonePanel({ className, contentClassName, size }) {
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')

  async function handleDeactivate() {
    setDeactivateError('')
    if (!window.confirm('Deactivate your account? An administrator can reactivate it later.')) return
    setDeactivating(true)
    try {
      await deactivateAccount()
      window.location.assign('/login')
    } catch (err) {
      setDeactivateError(err?.message || 'Failed to deactivate account.')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <Panel id="danger-zone" title="Danger zone" description="Deactivate your account. An administrator can reactivate it later." className={className} contentClassName={contentClassName} size={size} action={<ShieldCheck className="size-5 text-teal" />}>
      <p className="text-xs text-muted-foreground">
        Deactivating hides your account from JobLinked. An administrator can reactivate it later.
      </p>
      {deactivateError && <p role="alert" className="mt-3 text-xs text-destructive">{deactivateError}</p>}
      <Button type="button" variant="destructive" disabled={deactivating} onClick={handleDeactivate} className="mt-4">
        {deactivating ? 'Deactivating…' : 'Deactivate account'}
      </Button>
    </Panel>
  )
}

export default DangerZonePanel;