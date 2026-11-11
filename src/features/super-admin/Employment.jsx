import { useEffect, useMemo, useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listEmployees } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import ApplicationTimeline from '@/shared/components/ApplicationTimeline'
import { EmptyState, PageHeading, Panel, SearchInput, SelectField, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const STATUS_OPTIONS = ['Accepted', 'Terminated']

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium text-navy">{value || '—'}</dd>
    </div>
  )
}

export default function Employment() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    listEmployees()
      .then((rows) => setRecords(Array.isArray(rows) ? rows : rows?.data || []))
      .catch((err) => setError(err.message || 'Failed to load employment records'))
      .finally(() => setLoading(false))
  }, [])

  const types = useMemo(() => [...new Set(records.map((record) => record.job?.employment_type).filter(Boolean))], [records])

  const filtered = useMemo(() => {
    const text = query.toLowerCase()
    return records.filter((record) => {
      const haystack = `${record.seeker?.full_name || ''} ${record.job?.title || ''} ${record.job?.employers?.company_name || ''}`.toLowerCase()
      return (!status || record.status === status)
        && (!type || record.job?.employment_type === type)
        && haystack.includes(text)
    })
  }, [records, query, status, type])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) return <PageSkeleton stats={5} table label="Loading page." />
  if (error) return <InlineError message={error} />

  const stats = [
    ['Total hired employees', records.length],
    ['Currently active employees', records.filter((record) => record.status === 'Accepted').length],
    ['Resigned or separated', records.filter((record) => record.status === 'Terminated').length],
    ['Employers represented', new Set(records.map((record) => record.job?.employers?.company_name).filter(Boolean)).size],
    ['Barangays represented', new Set(records.map((record) => record.seeker?.barangay_district).filter(Boolean)).size],
  ]

  return (
    <>
      <PageHeading
        eyebrow="Beyond the hiring journey"
        title="Employment oversight"
        description="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
      />
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Panel key={label} title={String(label)}>
            <p className="break-words text-lg font-semibold text-navy">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel title="Employment records" description="Only records permitted for your current role are displayed.">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} placeholder="Search employee, position, or employer…" />
          <div className="sm:w-48">
            <SelectField
              id="employment-status"
              label="Employment status"
              placeholder="All statuses"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
            />
          </div>
          <div className="sm:w-48">
            <SelectField
              id="employment-type"
              label="Employment type"
              placeholder="All types"
              options={types}
              value={type}
              onChange={(event) => { setType(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {filtered.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date hired</TableHead>
                <TableHead>Start / end</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="max-w-40 truncate text-[10px] text-muted-foreground" title={record.id}>{record.id}</TableCell>
                  <TableCell>
                    <p className="font-medium text-navy">{titleCase(record.seeker?.full_name)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{titleCase(record.seeker?.barangay_district) || '—'}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{titleCase(record.job?.title)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{titleCase(record.job?.employers?.company_name)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{record.job?.office || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(record.employment?.created_at || record.updated_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {record.employment?.start_date ? formatDate(record.employment.start_date) : 'Not started'} / {record.employment?.end_date ? formatDate(record.employment.end_date) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{record.job?.employment_type || '—'}</TableCell>
                  <TableCell><StatusBadge status={record.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(record.updated_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setSelected(record)} aria-label={`View record for ${titleCase(record.seeker?.full_name)}`}>
                      View record
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No matching employment records"
            description={records.length ? 'Try changing the search or filters.' : 'A verified employer confirming a hire creates a linked employment record here.'}
          />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Employee profile</DialogTitle>
                <DialogDescription>Employment details and preserved status history.</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-1 gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2">
                <DetailRow label="Employee" value={titleCase(selected.seeker?.full_name)} />
                <DetailRow label="Employer" value={titleCase(selected.job?.employers?.company_name)} />
                <DetailRow label="Position" value={titleCase(selected.job?.title)} />
                <DetailRow label="Employment type" value={selected.job?.employment_type} />
                <DetailRow label="Barangay" value={titleCase(selected.seeker?.barangay_district)} />
                <DetailRow label="Email" value={selected.seeker?.email} />
                <DetailRow label="Start date" value={selected.employment?.start_date ? formatDate(selected.employment.start_date) : 'Not started'} />
                <DetailRow label="End date" value={selected.employment?.end_date ? formatDate(selected.employment.end_date) : '—'} />
              </dl>
              <ApplicationTimeline application={selected} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
