import { useEffect, useState } from 'react'
import { Check, CircleX, Clock3 } from 'lucide-react'
import { StatusBadge } from '@/shared/components/design'
import { getApplicationHistory } from '@/shared/services/applications'
import { cn } from '@/lib/utils'

const STAGE_COPY = {
  Applied: 'Application submitted by the candidate.',
  'Under Review': 'Employer opened the application.',
  Interview: 'Interview scheduled with the employer.',
  Accepted: 'Employer accepted the application.',
  Placed: 'Placement recorded.',
  Rejected: 'Application was not successful.',
  Terminated: 'Employment ended.',
}

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

// Recorded application status history, shared by the admin monitoring and
// employment views. Fetches by id so both pages can pass their own row.
export default function ApplicationTimeline({ application }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getApplicationHistory(application.id)
      .then((rows) => setHistory(rows || []))
      .catch((err) => setError(err.message || 'Could not load the recruitment history.'))
      .finally(() => setLoading(false))
  }, [application.id])

  if (loading) return <p className="text-xs text-muted-foreground">Loading history…</p>
  if (error) return <p role="alert" className="text-xs text-destructive">{error}</p>
  if (!history.length) return <p className="text-xs text-muted-foreground">No status changes recorded yet.</p>

  return (
    <div className="flex flex-col gap-6">
      <ol aria-label="Application status history" className="flex flex-col">
        {history.map((event, index) => {
          const last = index === history.length - 1
          const rejected = event.status === 'Rejected'
          return (
            <li key={`${event.changed_at}-${index}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={cn('timeline-dot', rejected && 'bg-danger-soft text-destructive', event.status === 'Placed' && 'bg-success-soft text-success')}>
                  {rejected ? <CircleX className="size-4" /> : last ? <Clock3 className="size-4" /> : <Check className="size-4" />}
                </span>
                {!last && <div className="min-h-10 w-px flex-1 bg-border" />}
              </div>
              <div className={cn('min-w-0 flex-1 pb-7', last && 'pb-0')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={event.status} />
                  <time className="text-[11px] text-muted-foreground" dateTime={event.changed_at}>{formatDate(event.changed_at)}</time>
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{event.remarks || STAGE_COPY[event.status] || 'Status updated.'}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="rounded-lg bg-muted px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        This is the recorded recruitment history, not a guaranteed sequence. Employers may skip stages; rejection is a final outcome, not a required step.
      </p>
    </div>
  )
}
