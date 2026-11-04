import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAuditLogs, listUsers } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import useDialog from '@/shared/hooks/useDialog'
import { InlineError } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, SelectField, StatusBadge, TextField } from '@/shared/components/design'

const ACTIVITY_TYPES = [
  'auth.login',
  'auth.login.failed',
  'auth.logout',
  'auth.register',
  'auth.password.change',
  'auth.password.reset.request',
  'profile.update',
  'profile.view',
  'job.search',
  'job.view',
  'job.list.view',
  'job.create',
  'job.update',
  'job.status.draft',
  'job.status.pending',
  'job.status.approved',
  'job.status.rejected',
  'job.status.published',
  'job.status.closed',
  'job.status.archived',
  'application.list.view',
  'application.create',
  'application.status.Applied',
  'application.status.Under Review',
  'application.status.Interview',
  'application.status.Accepted',
  'application.status.Rejected',
  'application.status.Terminated',
  'resume.upload',
  'resume.activate',
  'document.upload',
  'document.view',
  'document.pending',
  'document.verified',
  'document.rejected',
  'accreditation.submit',
  'accreditation.approved',
  'accreditation.rejected',
  'accreditation.revoked',
  'facebook.connect',
  'facebook.disconnect',
  'data.purge',
  'settings.reference.add',
  'settings.reference.remove',
  'settings.barangay.add',
  'settings.barangay.remove',
  'user.update',
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium text-navy">{value}</dd>
    </div>
  )
}

function UserModal({ email, onClose }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useDialog(onClose)

  useEffect(() => {
    if (!email) return
    listUsers({ search: email })
      .then((res) => setUser((res.data || []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [email])

  if (!email) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logs-user-title"
      >
        <div className="flex items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <p className="eyebrow">User profile</p>
            <h2 id="logs-user-title" className="mt-2 truncate text-lg font-semibold uppercase tracking-tight text-navy">
              {loading ? email : user?.full_name || email}
            </h2>
            {user?.role && <div className="mt-2"><StatusBadge status={user.role.replace('-', ' ')} /></div>}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border bg-muted/50 p-4">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading profile…</div>
          ) : !user ? (
            <div className="text-xs text-muted-foreground">No profile found for this email.</div>
          ) : (
            <>
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="Status" value={user.status} />
              {user.role === 'employer' && <InfoRow label="Company" value={user.company_name} />}
              <InfoRow label="Barangay" value={user.barangay_district || user.barangay} />
              <InfoRow label="City" value={user.city} />
              <InfoRow label="Member since" value={user.created_at && new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
            </>
          )}
        </dl>
        <div className="mt-5 flex justify-end border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Logs() {
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ userId: '', action: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')

  async function loadLogs(nextFilters = filters) {
    setLoading(true)
    setError('')
    try {
      const data = await listAuditLogs(nextFilters)
      setLogs(data)
    } catch (err) {
      setError(err.message || 'Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // ponytail: the user filter dropdown aggregates every account, so ask for the
    // 500-row server max (same client-side-aggregation rationale as Reports'
    // stat cards). Move to a search-keyed dropdown if accounts outgrow 500.
    Promise.all([listUsers({ pageSize: 500 }), listAuditLogs()])
      .then(([userRows, logRows]) => {
        setUsers(userRows.data)
        setLogs(logRows)
      })
      .catch((err) => setError(err.message || 'Failed to load activity logs'))
      .finally(() => setLoading(false))
  }, [])

  const actions = useMemo(() => [...new Set([...ACTIVITY_TYPES, ...logs.map((log) => log.action).filter(Boolean)])].sort(), [logs])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (loading) return <PageSkeleton stats={0} table />
  if (error) return <InlineError message={error} />

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <PageHeading
        eyebrow="A clear record of every step"
        title="Transparency is part of the work."
        description="Review approvals, posting changes, application updates, and system configuration activity."
      />

      <section className="surface flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="sm:w-52">
            <SelectField
              label="Filter by user"
              placeholder="All users"
              value={filters.userId}
              onChange={(e) => updateFilter('userId', e.target.value)}
              options={users.map((user) => ({ value: user.id, label: user.full_name || user.email }))}
            />
          </div>
          <div className="sm:w-56">
            <SelectField
              label="Filter by activity"
              placeholder="All activities"
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              options={[{ value: 'auth.', label: 'auth.* (all auth events)' }, ...actions.map((action) => ({ value: action, label: action }))]}
            />
          </div>
          <div className="w-full sm:w-40">
            <TextField label="From date" type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          </div>
          <div className="w-full sm:w-40">
            <TextField label="To date" type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </div>
          <Button type="button" onClick={() => loadLogs()}>Apply Filters</Button>
          <Button type="button" variant="outline" onClick={() => { const nextFilters = { ...filters, action: 'auth.' }; setFilters(nextFilters); loadLogs(nextFilters) }}>
            Login History
          </Button>
          <Button type="button" variant="ghost" onClick={() => { const nextFilters = { userId: '', action: '', from: '', to: '' }; setFilters(nextFilters); loadLogs(nextFilters) }}>
            Clear
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-auto">{logs.length} records</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {logs.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No activity logs match these filters." description="Clear the filters to see the full audit trail." />
            </div>
          ) : (
            <Table className="table-fixed">
              <colgroup>
                <col style={{ width: '200px' }} />
                <col style={{ width: '220px' }} />
                <col />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="align-top">
                    <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    <TableCell className="whitespace-normal text-xs">
                      {log.actor_email ? (
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setSelectedEmail(log.actor_email)}
                          className="h-auto justify-start break-all p-0 text-left text-xs font-normal"
                        >
                          {log.actor_email}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">{log.actor_name || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal break-all text-xs font-medium text-primary">{log.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
      {selectedEmail && <UserModal email={selectedEmail} onClose={() => setSelectedEmail('')} />}
    </div>
  )
}

export default Logs
