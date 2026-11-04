import { useEffect, useMemo, useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import useAuth from '@/shared/hooks/useAuth'
import { listEmployment } from '@/shared/services/seekers'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, Panel, SearchInput, SelectField, StatusBadge } from '@/shared/components/design'

const PAGE_SIZE = 8

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

const isCurrent = (record) => Boolean(record.is_current) || (!record.end_date && !record.endDate)

export default function Employment() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!user) return
    listEmployment()
      .then((rows) => setRecords(rows || []))
      .catch((err) => setError(err.message || 'Failed to load employment records'))
      .finally(() => setLoading(false))
  }, [user])

  const filtered = useMemo(() => {
    const text = query.toLowerCase()
    return records
      .filter((record) => !statusFilter || (statusFilter === 'current' ? isCurrent(record) : !isCurrent(record)))
      .filter((record) => `${record.employer_name || ''} ${record.position || ''}`.toLowerCase().includes(text))
      .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))
  }, [records, query, statusFilter])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const current = records.find(isCurrent)

  if (loading) return <PageSkeleton stats={5} table label="Loading page." />
  if (error) return <InlineError message={error} />

  const stats = [
    ['Current status', current ? 'Currently employed' : 'No active employment'],
    ['Current employer', current?.employer_name || '—'],
    ['Current position', current?.position || '—'],
    ['Employment start', current?.start_date ? formatDate(current.start_date) : 'Not recorded'],
    ['Employment records', records.length],
  ]

  return (
    <>
      <PageHeading
        eyebrow="Beyond the hiring journey"
        title="Employment Tracking"
        description="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
      />
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Panel key={label} title={String(label)}>
            <p className="break-words text-lg font-semibold text-navy">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel title="Employment history" description="Only records permitted for your current role are displayed.">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} label="Search employment records" placeholder="Search employer or position…" />
          <div className="sm:w-52">
            <SelectField
              id="employment-status"
              label="Employment status"
              placeholder="All statuses"
              options={[
                { value: 'current', label: 'Current' },
                { value: 'past', label: 'Past' },
              ]}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {filtered.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium text-navy">{record.employer_name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{record.position || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(record.start_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{record.end_date ? formatDate(record.end_date) : '—'}</TableCell>
                  <TableCell><StatusBadge status={isCurrent(record) ? 'Active' : 'Separated'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No employment records yet."
            description="When an employer confirms your hire, the linked employment record appears here."
          />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Panel>
    </>
  )
}
