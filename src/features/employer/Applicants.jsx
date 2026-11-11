import { useEffect, useMemo, useState } from 'react'
import { Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useAuth from '@/shared/hooks/useAuth'
import { listByCompany, updateApplicationStatus } from '@/shared/services/applications'
import { signedUrl } from '@/shared/services/documents'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import ApplicationTimeline from '@/shared/components/ApplicationTimeline'
import SeekerProfileCard from '@/shared/components/SeekerProfileCard'
import { EmptyState, Notice, PageHeading, Panel, SearchInput, SelectField, StatusBadge, TextField } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated']

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

const initialsOf = (name) => String(name || 'Candidate')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

function CandidateDetail({ application, onClose, onUpdated }) {
  const [status, setStatus] = useState(application.status)
  const [interviewAt, setInterviewAt] = useState(
    application.interview_at ? String(application.interview_at).slice(0, 16) : '',
  )
  const [instructions, setInstructions] = useState(application.interview_instructions || '')
  const [notes, setNotes] = useState(application.employer_notes || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const seeker = application.seeker

  async function submit(event) {
    event.preventDefault()
    if (status === 'Interview' && !interviewAt) {
      setError('Choose an interview date and time before saving.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await updateApplicationStatus(application.id, status, {
        interviewAt: status === 'Interview' ? interviewAt : null,
        interviewInstructions: status === 'Interview' ? instructions.trim() || null : null,
        employerNotes: notes.trim() || null,
      })
      onUpdated(application.id, {
        status,
        interview_at: status === 'Interview' ? interviewAt : null,
        interview_instructions: status === 'Interview' ? instructions.trim() : null,
        employer_notes: notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update the application.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{titleCase(seeker?.full_name)}</DialogTitle>
        <DialogDescription>
          Applied for {titleCase(application.job?.title) || 'a vacancy'} · {formatDate(application.applied_at)}
        </DialogDescription>
      </DialogHeader>
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Candidate profile"
            description="Shared for this application only. Use the information only for the intended recruitment purpose."
          >
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 break-all"><Mail className="size-4 shrink-0" />{seeker?.email || '—'}</p>
              <p className="flex items-center gap-2"><MapPin className="size-4" />{titleCase(seeker?.barangay_district) || 'Santa Maria'}</p>
            </div>
            <div className="mt-5"><SeekerProfileCard applicant={application} /></div>
          </Panel>
          <Panel title="Application history">
            <ApplicationTimeline application={application} />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Keep the candidate updated" description="Status changes update the connected job seeker’s timeline.">
            <form onSubmit={submit} className="flex flex-col gap-5">
              <SelectField
                id="recruitment-status"
                label="Recruitment status"
                options={APPLICATION_STATUSES}
                value={status}
                onChange={(event) => { setStatus(event.target.value); setError('') }}
              />
              {status === 'Interview' && (
                <>
                  <TextField
                    label="Interview date & time (Philippine time)"
                    type="datetime-local"
                    value={interviewAt}
                    onChange={(event) => setInterviewAt(event.target.value)}
                  />
                  <TextField
                    label="Location or meeting link"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    placeholder="Company address or meeting venue"
                  />
                </>
              )}
              <TextField
                label="Internal recruitment notes"
                multiline
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Private notes — only you see these…"
                help="Not shown to the candidate."
              />
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update candidate'}</Button>
              </div>
            </form>
          </Panel>
          <Notice title="Respect candidate privacy">
            These details must not be shared with unrelated employers. The API enforces ownership, purpose-limited access, and retention policies.
          </Notice>
        </div>
      </div>
    </>
  )
}

export default function Applicants() {
  const { user } = useAuth()
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [resumeError, setResumeError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listByCompany(user.id)
      .then((list) => { if (!cancelled) setApplicants(list || []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load applicants') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  const jobs = useMemo(() => {
    const seen = new Map()
    applicants.forEach((application) => {
      const job = application.job
      if (job?.id && !seen.has(job.id)) seen.set(job.id, job.title)
    })
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [applicants])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return applicants
      .filter((application) => (!jobFilter || application.job?.id === jobFilter) && (!statusFilter || application.status === statusFilter))
      .filter((application) => `${application.seeker?.full_name || ''} ${application.job?.title || ''}`.toLowerCase().includes(text))
      .sort((a, b) => String(b.applied_at).localeCompare(String(a.applied_at)))
  }, [applicants, jobFilter, statusFilter, query])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleUpdated(id, patch) {
    setApplicants((prev) => prev.map((application) => (application.id === id ? { ...application, ...patch } : application)))
  }

  // Reads the file through GET /files/resumes/* (ownership + application-link
  // checked server-side), so a 403 here means the applicant link is gone.
  async function openResume(application) {
    if (!application.resume?.file_path) return
    setResumeError('')
    try {
      window.open(await signedUrl('resumes', application.resume.file_path), '_blank', 'noopener')
    } catch (err) {
      setResumeError(err.status === 403
        ? 'You no longer have access to this resume. Ask the candidate to reapply.'
        : err.message || 'Could not open the resume.')
    }
  }

  if (loading) return <PageSkeleton stats={0} tables={1} label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        title="People with potential, close to home."
        description="Review candidates who applied to your company’s vacancies. Private profiles from unrelated employers are not shown."
      />
      <Panel title="Your applicants" description={`${records.length} applications in this view`}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchInput
            value={query}
            onChange={(value) => { setQuery(value); setPage(1) }}
            label="Search candidate or vacancy"
            placeholder="Search candidate or vacancy…"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[460px]">
            <SelectField
              id="applicant-vacancy"
              label="Your vacancy"
              placeholder="All your vacancies"
              options={jobs}
              value={jobFilter}
              onChange={(event) => { setJobFilter(event.target.value); setPage(1) }}
            />
            <SelectField
              id="applicant-status"
              label="Recruitment status"
              placeholder="All statuses"
              options={APPLICATION_STATUSES}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {records.length ? (
          <>
            {resumeError && <div className="mb-4"><InlineError message={resumeError} /></div>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Applied for</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-xs font-semibold text-primary">
                          {initialsOf(application.seeker?.full_name)}
                        </span>
                        <div>
                          <p className="font-medium text-navy">{titleCase(application.seeker?.full_name)}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{titleCase(application.seeker?.barangay_district) || 'Santa Maria'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{titleCase(application.job?.title)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(application.applied_at)}</TableCell>
                    <TableCell><StatusBadge status={application.status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {application.resume?.file_path && (
                          <Button
                            variant="ghost"
                            onClick={() => openResume(application)}
                            aria-label={`View resume for ${titleCase(application.seeker?.full_name)}`}
                          >
                            View resume
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => setSelected(application)} aria-label={`Review candidate ${titleCase(application.seeker?.full_name)}`}>
                          Review candidate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <EmptyState
            title="No candidates in this view yet."
            description="Try another vacancy or clear the filters. Candidates appear after a job seeker submits an application to your company."
          />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          {selected && (
            <CandidateDetail
              key={selected.id}
              application={selected}
              onClose={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
