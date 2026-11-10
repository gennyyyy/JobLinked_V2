import { useState, useEffect } from 'react'
import { CalendarDays, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { sendSystemNotification } from '@/shared/services/admin'
import { listNotifications } from '@/shared/services/notifications'
import useAuth from '@/shared/hooks/useAuth'
import { PanelSkeleton } from '@/shared/components/Skeletons'
import { EmptyState, Notice, PageHeading, Panel, SearchInput, TextField } from '@/shared/components/design'

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '')

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
  const [query, setQuery] = useState('')

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
        <div className="mb-5 max-w-xl">
          <SearchInput value={query} onChange={setQuery} placeholder="Search announcements…" />
        </div>
        {loading ? (
          <PanelSkeleton lines={3} />
        ) : (
          (() => {
            const visible = sent.filter((notice) => `${notice.title || ''} ${notice.message || ''}`.toLowerCase().includes(query.toLowerCase()))
            if (!visible.length) {
              return <EmptyState title="Make space for a useful update." description="No announcements match this search. Create a notice to see it here." />
            }
            return (
              <ul className="flex flex-col gap-4">
                {visible.map((notice) => (
                  <li key={notice.id} className="rounded-xl border p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{notice.expires_at && new Date(notice.expires_at) < new Date() ? 'Expired' : 'Published'}</Badge>
                    </div>
                    <h2 className="text-base font-semibold">{notice.title}</h2>
                    <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-7 text-muted-foreground">{notice.message}</p>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted-foreground">
                      <span>Notice date: {formatDate(notice.created_at)}</span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3" />
                        {notice.expires_at ? `Expires ${formatDate(notice.expires_at)}` : 'No expiry planned'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          })()
        )}
        {result && <p className="mt-4 text-xs text-success">{result}</p>}
      </Panel>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a useful community notice</DialogTitle>
            <DialogDescription>Published notices appear on the PESO Services page and in in-app inboxes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSend} className="flex flex-col gap-5">
            <TextField
              id="sys-title"
              label="Announcement title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Job fair on Saturday"
            />
            <TextField
              id="sys-message"
              label="Notice content"
              multiline
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Announcement details…"
            />
            <TextField
              id="sys-expires"
              label="Expiry date (optional)"
              help="Planning only. The notice stops showing after this date."
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sending}>
                <Send data-icon="inline-start" />
                {sending ? 'Saving…' : 'Save notice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
