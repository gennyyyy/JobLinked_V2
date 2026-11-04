import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, Handshake, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAllApplications } from '@/shared/services/admin'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { InlineError } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, Panel, SelectField, StatCards, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 10

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    listAllApplications({ pageSize: 500 })
      .then((result) => setApplications(result.data || []))
      .catch((err) => setError(err.message || 'Failed to load applications'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const text = query.toLowerCase()
    return applications.filter((application) => {
      const haystack = `${application.seeker?.full_name || ''} ${application.job?.title || ''} ${application.job?.employers?.company_name || ''}`.toLowerCase()
      return (status === 'all' || application.status === status) && haystack.includes(text)
    })
  }, [applications, query, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function exportCsv() {
    const rows = [
      ['Candidate', 'Vacancy', 'Employer', 'Barangay', 'Submitted', 'Status', 'Referred', 'Placement'],
      ...filtered.map((application) => [
        application.seeker?.full_name || '',
        application.job?.title || '',
        application.job?.employers?.company_name || '',
        application.seeker?.barangay_district || '',
        String(application.applied_at || '').slice(0, 10),
        application.status || '',
        application.referred_by ? 'Yes' : 'No',
        application.status === 'Placed' || application.status === 'Hired' ? 'Yes' : 'No',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'applications.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="Follow every connection"
        title="From opportunity to a new beginning."
        description="Monitor recruitment outcomes and record referral markers. No external referral is sent."
        action={
          <Button type="button" variant="outline" disabled={!filtered.length} onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />
      <StatCards
        stats={[
          { label: 'Applications in view', value: filtered.length, icon: ClipboardList },
          { label: 'Recorded referrals', value: filtered.filter((application) => application.referred_by).length, icon: Handshake },
          { label: 'placements', value: filtered.filter((application) => ['Placed', 'Hired'].includes(application.status)).length, icon: Users, tone: 'teal' },
          { label: 'Interview stage', value: filtered.filter((application) => application.status === 'Interview Scheduled').length, icon: Users, tone: 'teal' },
        ]}
      />
      <Panel title="Applications & placements" description="Placement means an application currently marked Hired. These are provided outcomes.">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="applications-search" className="mb-2 block text-xs text-muted-foreground">Search records</label>
            <Input id="applications-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search candidate, vacancy, or employer…" />
          </div>
          <div className="sm:w-56">
            <SelectField
              id="applications-status"
              label="Recruitment status"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Under Review', label: 'Under Review' },
                { value: 'Shortlisted', label: 'Shortlisted' },
                { value: 'Interview Scheduled', label: 'Interview Scheduled' },
                { value: 'Accepted', label: 'Accepted' },
                { value: 'Placed', label: 'Placed' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No applications match this view." description="Adjust the search or status filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Vacancy</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <p className="text-xs font-medium text-navy">{titleCase(application.seeker?.full_name)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{application.seeker?.barangay_district || '—'}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{application.job?.title}</TableCell>
                  <TableCell className="text-[11px] uppercase text-muted-foreground">{application.job?.employers?.company_name}</TableCell>
                  <TableCell><StatusBadge status={application.status} /></TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{application.referred_by ? 'Referred' : '—'}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{new Date(application.applied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  )
}
