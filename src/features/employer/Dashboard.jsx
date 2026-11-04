import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Handshake, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react'
import useAuth from '@/shared/hooks/useAuth'
import { getEmployerDashboard } from '@/shared/services/applications'
import { getEmployer } from '@/shared/services/auth'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import { EmptyState, LinkButton, Notice, PageHeading, Panel, StatCards, StatusBadge } from '@/shared/components/design'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { titleCase } from '@/shared/utils/titleCase'

export default function Dashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [summaryStats, setSummaryStats] = useState({})
  const [recent, setRecent] = useState([])
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    getEmployer()
      .then((data) => {
        setCompany(data)
        return getEmployerDashboard()
      })
      .then((summary) => {
        setJobs(summary.jobs || [])
        setSummaryStats(summary.stats || {})
        setRecent(summary.recent || [])
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <PageSkeleton stats={4} panels={2} />
  if (error) return <InlineError message={error} />

  const totalCandidates = summaryStats.total_candidates || 0
  const companyName = company?.company_name || 'My Company'
  const accreditation = company?.accreditation_status
  const firstName = user?.first_name || String(user?.full_name || user?.name || 'there').split(' ')[0]

  return (
    <>
      <PageHeading
        eyebrow="Build something together"
        title={`Welcome back, ${firstName}.`}
        description={`Good people make great teams. Here’s what’s happening at ${titleCase(companyName)}.`}
        action={<LinkButton href="/employer/job-posts"><Plus data-icon="inline-start" />Create a vacancy</LinkButton>}
      />
      {accreditation && accreditation !== 'approved' && (
        <Notice title={`Accreditation: ${accreditation}`} warning>
          You can prepare drafts, but publishing is unavailable until PESO approves your accreditation.{' '}
          <Link to="/employer/accreditation" className="font-medium underline underline-offset-4">Review requirements and feedback.</Link>
        </Notice>
      )}
      <StatCards
        stats={[
          { label: 'Active vacancies', value: jobs.filter((job) => job.status === 'published').length, icon: BriefcaseBusiness },
          { label: 'Total applicants', value: totalCandidates, icon: Users },
          { label: 'Shortlisted candidates', value: summaryStats.shortlisted || 0, icon: UserCheck, tone: 'teal' },
          { label: 'placements', value: summaryStats.placements || 0, icon: Handshake, tone: 'teal' },
        ]}
      />
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Your latest applicants"
            description="Meet the people interested in joining your team."
            action={<Link to="/employer/applicants" className="text-link text-[11px]">View all<ArrowRight className="size-3" /></Link>}
          >
            {recent.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead><span className="sr-only">Review</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.slice(0, 5).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link to="/employer/applicants" className="text-xs font-semibold text-navy hover:text-primary">{titleCase(item.seeker_full_name)}</Link>
                        <p className="mt-1 text-[10px] text-muted-foreground">{item.job_title}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell>
                        <Link to="/employer/applicants" className="text-link text-xs">Review<ArrowRight className="size-3" /></Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Your next teammate is out there." description="Publish an approved vacancy to start receiving applications." href="/employer/job-posts" label="Create a vacancy" />
            )}
          </Panel>
          <Panel
            title="Your vacancies"
            description="A quick look at the opportunities you are creating."
            action={<Link className="text-link text-[11px]" to="/employer/job-posts">Manage jobs<ArrowRight className="size-3" /></Link>}
          >
            {jobs.length ? (
              <ul className="flex flex-col divide-y">
                {jobs.slice(0, 4).map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <Link to="/employer/job-posts" className="text-xs font-semibold text-navy hover:text-primary">{job.title}</Link>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {job.location || 'Santa Maria'} · {job.vacancies || 1} openings · {job.applicants || 0} applicants
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No vacancies yet. Start with a draft.</p>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Your accreditation" action={<ShieldCheck className="size-5 text-teal" />}>
            {accreditation ? <StatusBadge status={{ approved: 'Approved', pending: 'Pending Review', rejected: 'Rejected', resubmission: 'Resubmission Requested', revoked: 'Suspended', none: 'Pending Review' }[accreditation] || accreditation} /> : null}
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              {accreditation === 'approved'
                ? 'Your business is approved to publish vacancies.'
                : 'A PESO administrator can review your submitted metadata and update the decision.'}
            </p>
            <Link to="/employer/accreditation" className="text-link mt-3 text-xs">View accreditation<ArrowRight className="size-3" /></Link>
          </Panel>
          <div className="rounded-2xl border border-teal/10 bg-teal-soft p-6">
            <ClipboardCheck className="mb-4 size-6 text-teal" />
            <h2 className="text-base font-semibold">Thoughtful hiring starts here.</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">Keep qualifications clear, set a realistic deadline, and update candidates as you go. A little communication makes a big difference.</p>
            <Link className="text-link mt-3 text-xs" to="/employer/job-posts">Write a great job post<ArrowRight className="size-3" /></Link>
          </div>
          <Panel title="Recent recruitment activity" description="Updates from your own vacancies only.">
            <ul className="flex flex-col gap-4">
              {recent.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <p className="text-xs leading-6 text-navy">{titleCase(item.seeker_full_name)} · {item.job_title}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(item.applied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                </li>
              ))}
              {!recent.length && <li className="text-xs text-muted-foreground">Activity will appear here as candidates apply.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
