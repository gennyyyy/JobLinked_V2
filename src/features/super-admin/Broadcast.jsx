import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { sendSystemNotification } from '@/shared/services/admin'
import { listNotifications } from '@/shared/services/notifications'
import useAuth from '@/shared/hooks/useAuth'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { EmptyState, PageHeading, Panel, TextField } from '@/shared/components/design'

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
  const [tab, setTab] = useState('compose')

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

  const tabClass = (name) => (tab === name
    ? 'rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground'
    : 'rounded-xl border border-border bg-card px-4 text-xs font-medium text-muted-foreground hover:bg-muted')

  return (
    <>
      <PageHeading
        eyebrow="Keep your community connected"
        title="A little information opens new doors."
        description="Create employment notices and preview a vacancy distribution plan."
      />
      <div role="group" aria-label="Broadcast sections" className="mb-6 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setTab('compose')} aria-current={tab === 'compose' ? 'true' : undefined} className={tabClass('compose')}>
          Compose
        </Button>
        <Button type="button" onClick={() => setTab('recent')} aria-current={tab === 'recent' ? 'true' : undefined} className={tabClass('recent')}>
          {`Recent broadcasts (${sent.length})`}
        </Button>
      </div>

      {tab === 'compose' ? (
        <Panel title="Compose an announcement" description="Every active account receives this message in their notifications.">
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
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <TextField
              id="sys-expires"
              label="Expires"
              help="Optional. The announcement stops showing after this date."
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            {result && <p className="text-xs text-success">{result}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>
                <Send data-icon="inline-start" />
                {sending ? 'Sending…' : 'Send Broadcast'}
              </Button>
            </div>
          </form>
        </Panel>
      ) : (
        <Panel title="Recent broadcasts" description="Announcements sent to all users.">
          {loading ? (
            <LoadingScreen />
          ) : sent.length === 0 ? (
            <EmptyState title="No system broadcasts yet." description="Announcements you send will be listed here." />
          ) : (
            <ul className="flex flex-col divide-y">
              {sent.slice(0, 5).map((n) => (
                <li key={n.id} className="py-3 first:pt-0">
                  <p className="flex items-center gap-2 text-xs font-semibold text-navy">
                    <Megaphone className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    {n.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  )
}
