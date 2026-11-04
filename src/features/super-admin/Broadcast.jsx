import { useState, useEffect } from 'react'
import { Megaphone, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { sendSystemNotification } from '@/shared/services/admin'
import { listNotifications } from '@/shared/services/notifications'
import useAuth from '@/shared/hooks/useAuth'
import { PanelSkeleton } from '@/shared/components/Skeletons'
import { EmptyState, Notice, PageHeading, Panel, TextField } from '@/shared/components/design'

export default function Broadcast() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    listNotifications(user.id)
      .then((rows) => {
        setSent((rows || []).filter((n) => n.type === 'system'))
        setLoading(false)
      })
      .catch(() => {
        setSent([])
        setLoading(false)
      })
  }, [user])

  async function handleSend(e) {
    e.preventDefault()
    if (!title.trim() || !message.trim()) { setError('Title and message are required.'); return }
    setError('')
    setResult('')
    setSending(true)
    try {
      const res = await sendSystemNotification({ title: title.trim(), message: message.trim(), expires_at: expiresAt || null })
      setResult(`Broadcast sent to ${res?.sent ?? '?'} user(s).`)
      setTitle('')
      setMessage('')
      setExpiresAt('')
      setComposeOpen(false)
      try {
        const rows = await listNotifications(user.id)
        setSent((rows || []).filter((n) => n.type === 'system'))
      } catch { /* list refresh is best-effort */ }
    } catch (err) {
      setError(err.message || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Keep your community connected"
        title="A little information opens new doors."
        description="Create employment notices and preview a vacancy distribution plan."
        action={
          <Button type="button" onClick={() => { setError(''); setComposeOpen(true) }}>
            <Plus data-icon="inline-start" />
            Create announcement
          </Button>
        }
      />
      <div className="mb-6">
        <Notice title="No automatic distribution">
          Published notices appear on the PESO Services page and in-app inboxes. A distribution date is a planning marker only; Facebook, email, SMS, and government-system integrations are unavailable.
        </Notice>
      </div>
      <Panel title="Your employment notices" description="Published notices and working drafts, together in one place.">
        {loading ? (
          <PanelSkeleton lines={3} />
        ) : sent.length === 0 ? (
          <EmptyState title="No published notices yet." description="Announcements you send will be listed here." />
        ) : (
          <ul className="flex flex-col gap-4">
            {sent.map((n) => (
              <li key={n.id} className="rounded-xl border bg-muted/40 p-4">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.14em] text-primary">
                  <Megaphone className="size-3.5 shrink-0" aria-hidden="true" />
                  Published
                </p>
                <h2 className="mt-2 text-sm font-semibold text-navy">{n.title}</h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{n.message}</p>
                {n.created_at && <p className="mt-2 text-[10px] text-muted-foreground">Notice date: {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              </li>
            ))}
          </ul>
        )}
        {result && <p className="mt-4 text-xs text-success">{result}</p>}
      </Panel>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create announcement</DialogTitle>
            <DialogDescription>Every active account receives this message in their notifications.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSend} className="flex flex-col gap-5">
            <TextField
              id="sys-title"
              label="Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Job fair on Saturday"
            />
            <TextField
              id="sys-message"
              label="Message"
              multiline
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Announcement details…"
            />
            <TextField
              id="sys-expires"
              label="Expires"
              help="Optional. The announcement stops showing after this date."
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sending}>
                <Send data-icon="inline-start" />
                {sending ? 'Sending…' : 'Send Broadcast'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
