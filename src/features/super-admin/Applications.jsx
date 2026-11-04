import { useEffect, useMemo, useState } from 'react'
import { Clock3, Download, Handshake, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAllApplications } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import ApplicationTimeline from '@/shared/components/ApplicationTimeline'
import { EmptyState, PageHeading, Panel, SearchInput, SelectField, StatCards, StatusBadge } from '@/shared/components/design'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const STATUS_OPTIONS = ['Applied', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated']

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [barangay, setBarangay] = useState('')
  const [referral, setReferral] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    listAllApplications({ pageSize: 500 })
      .then((result) => setApplications(result.data || []))
      .catch((err) => setError(err.message || 'Failed to load applications'))
      .finally(() => setLoading(false))
  }, [])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return applications.filter((application) => {
      const haystack = `${application.seeker?.full_name || ''} ${application.job?.title || ''} ${application.job?.employers?.company_name || ''}`.toLowerCase()
      return (!status || application.status === status)
        && (!barangay || application.seeker?.barangay_district === barangay)
        && (!referral || Boolean(application.referred_by) === (referral === 'Referred'))
        && haystack.includes(text)
    })
  }, [applications, query, status, barangay, referral])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function exportCsv() {
    const rows = [
      ['Application ID', 'Job title', 'Employer', 'Barangay', 'Submitted', 'Current status', 'Referral', 'Placement'],
      ...records.map((application) => [
        application.id,
        application.job?.title || '',
        application.job?.employers?.company_name || '',
        application.seeker?.barangay_district || '',
        String(application.applied_at || '').slice(0, 10),
        application.status || '',
        application.referred_by ? 'Yes' : 'No',
        application.status === 'Placed' ? 'Yes' : 'No',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'joblinked-DEMO-applications.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton stats={4} table label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="Follow every connection"
        title="From opportunity to a new beginning."
        description="Monitor recruitment outcomes and record referral markers. No external referral is sent."
        action={(
          <Button variant="outline" disabled={!records.length} onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        )}
      />
      <StatCards
        stats={[
          { label: 'Applications in view', value: records.length, icon: Clock3 },
          { label: 'Recorded referrals', value: records.filter((application) => application.referred_by).length, icon: Handshake },
          { label: 'placements', value: records.filter((application) => application.status === 'Placed').length, icon: Users, tone: 'teal' },
          { label: 'Interview stage', value: records.filter((application) => application.status === 'Interview').length, icon: Users, tone: 'teal' },
        ]}
      />
      <Panel title="Applications & placements" description="Placement means an application currently marked Placed. These are provided outcomes.">
        <div className="mb-5 flex flex-col gap-3">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} placeholder="Search candidate, vacancy, or employer…" />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              id="applications-status"
              label="Recruitment status"
              placeholder="All statuses"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
            />
            <SelectField
              id="applications-barangay"
              label="Candidate barangay"
              placeholder="All 24 barangays"
              options={SANTA_MARIA_BARANGAYS}
              value={barangay}
              onChange={(event) => { setBarangay(event.target.value); setPage(1) }}
            />
            <SelectField
              id="applications-referral"
              label="Referral marker"
              placeholder="All referral outcomes"
              options={['Referred', 'Not referred']}
              value={referral}
              onChange={(event) => { setReferral(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate & vacancy</TableHead>
                <TableHead>Barangay</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>History</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <p className="font-medium text-navy">{titleCase(application.seeker?.full_name)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{application.job?.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{titleCase(application.job?.employers?.company_name)}</p>
                  </TableCell>
                  <TableCell>{application.seeker?.barangay_district || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={application.status} />
                    {application.status === 'Placed' && <p className="mt-2 text-[10px] text-teal">placement recorded</p>}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{application.referred_by ? 'Referred' : 'Not referred'}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      onClick={() => setSelected(application)}
                      aria-label={`View application history for ${titleCase(application.seeker?.full_name)}`}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No recruitment records match." description="Try another status, barangay, referral marker, or search." />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Recruitment history</DialogTitle>
                <DialogDescription>
                  {titleCase(selected.seeker?.full_name)} · {selected.job?.title} · Submitted {formatDate(selected.applied_at)}
                </DialogDescription>
              </DialogHeader>
              <ApplicationTimeline application={selected} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
