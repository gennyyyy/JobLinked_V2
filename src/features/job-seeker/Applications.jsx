import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useAuth from '@/shared/hooks/useAuth'
import { listBySeeker } from '@/shared/services/applications'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import ApplicationTimeline from '@/shared/components/ApplicationTimeline'
import { CompanyMark, EmptyState, H3, LinkButton, Notice, PageHeading, Panel, SearchInput, SelectField, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated']

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

const formatDateTime = (value) => (value
  ? new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  : null)

const initialsOf = (name) => String(name || 'Company')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

function ApplicationDetail({ application }) {
  const interview = formatDateTime(application.interview_at)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{titleCase(application.job?.title) || 'Application'}</DialogTitle>
        <DialogDescription>
          {titleCase(application.job?.employers?.company_name)} · Submitted {formatDate(application.applied_at)}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        {interview && (
          <Notice title="Interview scheduled" warning>
            {interview} · Philippine time
            {application.interview_instructions ? ` · ${application.interview_instructions}` : ''}
          </Notice>
        )}
        <div>
          <H3 className="text-xs font-semibold text-navy" animated={false}>Your application journey</H3>
          <p className="mt-1 text-[11px] text-muted-foreground">Updates from the employer appear here and in your notifications.</p>
          <div className="mt-4"><ApplicationTimeline application={application} /></div>
        </div>
        {application.employer_notes && (
          <div className="rounded-xl border bg-muted p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Note from employer</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-6 text-navy">{application.employer_notes}</p>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
          <Link to={`/job-seeker/jobs/${application.job_id || application.job?.id}`} className="text-link text-xs">View vacancy</Link>
        </div>
      </div>
    </>
  )
}

export default function Applications() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listBySeeker(user.id)
      .then((result) => { if (!cancelled) setApplications(result || []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load applications') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return applications
      .filter((application) => !statusFilter || application.status === statusFilter)
      .filter((application) => `${application.job?.title || ''} ${application.job?.employers?.company_name || ''}`.toLowerCase().includes(text))
      .sort((a, b) => String(b.applied_at).localeCompare(String(a.applied_at)))
  }, [applications, query, statusFilter])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) return <PageSkeleton table label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="Every step counts"
        title="See how your story is moving."
        description="Track your applications, from your first hello to the employer’s decision."
        action={(
          <LinkButton href="/job-seeker/jobs">
            <BriefcaseBusiness data-icon="inline-start" />
            Find more opportunities
          </LinkButton>
        )}
      />
      <Panel title="My applications" description="Only applications submitted by your current account are shown.">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={query}
            onChange={(value) => { setQuery(value); setPage(1) }}
            label="Search by job or employer"
            placeholder="Search by job or employer…"
          />
          <div className="sm:w-52">
            <SelectField
              id="application-status"
              label="Application status"
              placeholder="All statuses"
              options={APPLICATION_STATUSES}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Details</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CompanyMark initials={initialsOf(application.job?.employers?.company_name)} />
                      <div>
                        <button type="button" onClick={() => setSelected(application)} className="text-left font-medium text-navy hover:text-primary">
                          {titleCase(application.job?.title) || 'Unavailable vacancy'}
                        </button>
                        <p className="mt-1 text-[11px] text-muted-foreground">{titleCase(application.job?.employers?.company_name)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(application.applied_at)}</TableCell>
                  <TableCell><StatusBadge status={application.status} /></TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setSelected(application)} aria-label={`Track application for ${titleCase(application.job?.title) || 'vacancy'}`}>
                      Track
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="A fresh start is a good start."
            description="No applications match this view. Explore an opportunity and submit an application to see it here."
            href="/job-seeker/jobs"
          />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <ApplicationDetail application={selected} />
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>Done</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
