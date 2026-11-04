import { useEffect, useMemo, useState } from 'react'
import { Download, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAuditLogs } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, Panel, SearchInput } from '@/shared/components/design'

const PAGE_SIZE = 8

const formatStamp = (value) => (value
  ? new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })
  : '—')

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    listAuditLogs()
      .then((rows) => setLogs(rows || []))
      .catch((err) => setError(err.message || 'Failed to load activity logs'))
      .finally(() => setLoading(false))
  }, [])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return logs
      .filter((log) => `${log.actor_name || ''} ${log.actor_email || ''} ${log.action || ''} ${log.entity || ''} ${log.entity_id || ''}`.toLowerCase().includes(text))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }, [logs, query])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function exportLog() {
    const rows = [
      ['DEMO timestamp', 'Actor', 'Action', 'Record'],
      ...records.map((log) => [log.created_at, log.actor_name || log.actor_email || '', log.action || '', [log.entity, log.entity_id].filter(Boolean).join(' / ')]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'joblinked-DEMO-audit-log.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton table label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="A clear record of every step"
        title="Transparency is part of the work."
        description="Review approvals, posting changes, application updates, and system configuration activity."
        action={(
          <Button variant="outline" disabled={!records.length} onClick={exportLog}>
            <Download data-icon="inline-start" />
            Export log
          </Button>
        )}
      />
      <Panel
        title="Workspace activity log"
        description="Read-only in the interface. This log is not a tamper-proof production audit system."
      >
        <div className="mb-5 max-w-xl">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} placeholder="Search actor, action, or record…" />
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={log.created_at}>{formatStamp(log.created_at)}</time>
                    <p className="mt-1 text-[9px] text-muted-foreground">Philippine time</p>
                  </TableCell>
                  <TableCell>{log.actor_name || log.actor_email || '—'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 text-xs">
                      <ScrollText className="size-3.5 shrink-0 text-primary" />
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-xs truncate text-xs text-muted-foreground" title={[log.entity, log.entity_id].filter(Boolean).join(' / ')}>
                      {[log.entity, log.entity_id].filter(Boolean).join(' / ') || '—'}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No activity matches this search." description="Clear the search or perform a workflow to add activity." />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>
    </>
  )
}
