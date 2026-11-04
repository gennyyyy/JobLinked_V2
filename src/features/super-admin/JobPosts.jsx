import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Flag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { editJob, listAllJobs } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { EmptyState, Notice, PageHeading, Panel, SearchInput, SelectField, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const STATUS_OPTIONS = ['Draft', 'Pending', 'Approved', 'Rejected', 'Published', 'Closed', 'Archived']
const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
}

const salaryLabel = (job) => (job.salary_min
  ? `₱${job.salary_min}${job.salary_max ? ` – ₱${job.salary_max}` : ''}`
  : 'Negotiable')

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

function VacancyReview({ job, onClose, onDecided }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const company = job.employers
  const approved = company?.accreditation_status === 'approved'

  async function decide(status) {
    const note = reason.trim()
    if ((status === 'rejected' || status === 'archived') && note.length < 10) {
      setError('Provide a moderation reason of at least 10 characters.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await editJob(job.id, { status, remarks: note || null })
      onDecided(job.id, status, note)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update the posting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{job.title}</DialogTitle>
        <DialogDescription>
          {titleCase(company?.company_name)} · {job.location || 'Santa Maria'} · {job.employment_type || 'Employment type not set'}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={STATUS_LABELS[job.status] || job.status} />
        <StatusBadge status={company?.accreditation_status ? titleCase(company.accreditation_status) : 'Pending Review'} />
      </div>
      <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-muted p-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Monthly salary</dt>
          <dd className="mt-2 font-medium">{salaryLabel(job)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deadline</dt>
          <dd className="mt-2 font-medium">{formatDate(job.deadline)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Openings</dt>
          <dd className="mt-2">{job.vacancies || 1}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Work arrangement</dt>
          <dd className="mt-2">{job.work_arrangement || '—'}</dd>
        </div>
      </dl>
      {job.description && <p className="whitespace-pre-wrap text-xs leading-7 text-muted-foreground">{job.description}</p>}
      {job.requirements && (
        <>
          <h3 className="text-xs font-semibold">Qualifications</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-xs text-muted-foreground">
            {String(job.requirements).split('\n').filter(Boolean).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      )}
      {job.remarks && (
        <Notice title="Previous moderation feedback" warning>{job.remarks}</Notice>
      )}
      <div>
        <Label htmlFor="moderation-reason" className="mb-2 block text-xs text-muted-foreground">Moderation note / reason</Label>
        <Textarea
          id="moderation-reason"
          rows={3}
          maxLength={2000}
          value={reason}
          onChange={(event) => { setReason(event.target.value); setError('') }}
          placeholder="Required when flagging or removing a posting. Shared with the employer."
        />
        <p className="mt-1 text-[10px] text-muted-foreground">Required when flagging or removing a posting. Shared with the employer.</p>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button disabled={busy || !approved} onClick={() => decide('published')}>
          <CheckCircle2 data-icon="inline-start" />
          Approve / restore
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => decide('rejected')}>
          <Flag data-icon="inline-start" />
          Flag posting
        </Button>
        <Button variant="destructive" disabled={busy || job.status === 'archived'} onClick={() => decide('archived')}>
          <Trash2 data-icon="inline-start" />
          Remove posting
        </Button>
      </div>
      <p className="text-[10px] leading-5 text-muted-foreground">
        Approval requires an approved employer and an unexpired deadline. Removed records remain in the audit and recruitment history.
      </p>
    </>
  )
}

export default function JobPosts() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [reviewing, setReviewing] = useState(null)

  useEffect(() => {
    listAllJobs({ pageSize: 500 })
      .then((result) => setJobs(result.data || []))
      .catch((err) => setError(err.message || 'Failed to load job postings'))
      .finally(() => setLoading(false))
  }, [])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return jobs
      .filter((job) => !statusFilter || job.status === statusFilter.toLowerCase())
      .filter((job) => `${job.title || ''} ${job.employers?.company_name || ''}`.toLowerCase().includes(text))
  }, [jobs, query, statusFilter])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleDecided(id, status, remarks) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status, remarks } : job)))
  }

  if (loading) return <PageSkeleton table label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="Keep local opportunities trustworthy"
        title="Clear standards. Better opportunities."
        description="Inspect job postings, confirm employer approval, and record moderation decisions."
      />
      <Panel
        title="Vacancy oversight"
        description="Moderation changes are recorded in the audit log."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} placeholder="Search vacancy or employer…" />
          <div className="sm:w-48">
            <SelectField
              id="vacancy-status"
              label="Vacancy status"
              placeholder="All posting states"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>

        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vacancy</TableHead>
                <TableHead>Employer approval</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <p className="font-medium text-navy">{job.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {titleCase(job.employers?.company_name)} · {job.location || 'Santa Maria'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.employers?.accreditation_status ? titleCase(job.employers.accreditation_status) : 'Pending Review'} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(job.deadline)}</TableCell>
                  <TableCell>
                    <StatusBadge status={STATUS_LABELS[job.status] || job.status} />
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setReviewing(job)} aria-label={`Review vacancy ${job.title}`}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No vacancies in this view." description="Clear your filters to see more postings." />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) setReviewing(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {reviewing && (
            <VacancyReview
              key={reviewing.id}
              job={reviewing}
              onClose={() => setReviewing(null)}
              onDecided={handleDecided}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
