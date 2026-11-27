import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Building2, ChartNoAxesCombined, CheckCircle2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react'
import { getStats, listAllAccreditations, listAllApplications, listAuditLogs } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import { EmploymentActivityChart } from '@/shared/components/lazyCharts'
import useAuth from '@/shared/hooks/useAuth'
import { CompanyMark, EmptyState, LinkButton, PageHeading, Panel, StatCards, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

export default function Dashboard() {
  const { user } = useAuth() || {}
  const [stats, setStats] = useState(null)
  const [accreditations, setAccreditations] = useState([])
  const [applications, setApplications] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStats(), listAllAccreditations(), listAllApplications({ pageSize: 500 }), listAuditLogs({ limit: 5 })])
      .then(([statsData, accs, applicationRows, audit]) => {
        setStats(statsData)
        setAccreditations((accs.data || []).filter((item) => item.status === 'pending').slice(0, 5))
        setApplications(applicationRows.data || [])
        setLogs(Array.isArray(audit) ? audit.slice(0, 5) : (audit?.data || []).slice(0, 5))
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton stats={4} panels={2} />
  if (error) return <InlineError message={error} />
  if (!stats) return null

  const firstName = titleCase(user?.first_name || String(user?.full_name || user?.name || 'reviewer').split(' ')[0])
  const accreditationStatusLabel = (status) => ({
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    resubmission: 'Resubmission Requested',
    revoked: 'Revoked',
  }[status] || status)

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - 13 + index)
    const key = date.toISOString().slice(0, 10)
    const rows = applications.filter((application) => String(application.applied_at || '').slice(0, 10) === key)
    return {
      month: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date),
      applications: rows.length,
      placements: rows.filter((application) => application.status === 'Placed' || application.status === 'Hired' || application.status === 'Accepted').length,
    }
  })

  return (
    <>
      <PageHeading
        title="A clearer picture of local opportunity."
        description={`Welcome, ${firstName}. Here’s your Santa Maria employment workspace at a glance.`}
        action={<LinkButton href="/super-admin/reports" variant="outline"><ChartNoAxesCombined data-icon="inline-start" />View reports</LinkButton>}
      />
      <StatCards
        countUp
        stats={[
          { label: 'Registered job seekers', value: stats.seekers ?? 0, icon: Users },
          { label: 'Local employers', value: stats.employers ?? 0, icon: Building2 },
          { label: 'Pending accreditations', value: stats.pendingAccreditations ?? 0, icon: ShieldCheck, note: 'submissions awaiting review', tone: 'teal' },
          { label: 'Active vacancies', value: stats.ACTIVE_VACANCIES ?? stats.approvedJobs ?? stats.jobs ?? 0, icon: BriefcaseBusiness, tone: 'teal' },
        ]}
      />
      <StatCards
        countUp
        stats={[
          { label: 'applications', value: stats.applications ?? 0, icon: ClipboardCheck, note: 'submitted' },
          { label: 'accepted', value: stats.ACCEPTED_TOTAL ?? stats.acceptedApplicants ?? 0, icon: CheckCircle2, note: 'employer accepted', tone: 'teal' },
          ...(stats.PLACED_TOTAL !== undefined || stats.placedApplicants !== undefined
            ? [{ label: 'placements', value: stats.PLACED_TOTAL ?? stats.placedApplicants, icon: Users, note: 'confirmed hires', tone: 'teal' }]
            : []),
        ]}
      />
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Local employment activity"
            description="Last 14 days · Provided applications grouped by submission date; placements reflect current outcomes."
          >
            <EmploymentActivityChart data={days} />
          </Panel>
          <Panel
            title="Accreditation review queue"
            description="Help local employers take the next step."
            action={<Link className="text-link text-xs" to="/super-admin/accreditation">Open queue<ArrowRight className="size-3" /></Link>}
          >
            {accreditations.length ? (
              <ul className="flex flex-col divide-y">
                {accreditations.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                    <CompanyMark initials={String(item.employers?.company_name || 'E').slice(0, 2).toUpperCase()} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-navy">{titleCase(item.employers?.company_name)}</p>
                      <p className="mt-1 text-micro text-muted-foreground">{titleCase(item.employers?.barangay_district)} · Submitted {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <StatusBadge status={accreditationStatusLabel(item.status)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No employer applications submitted yet." description="New accreditation requests will appear here." />
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Recent workspace activity" description="changes across all three roles.">
            <ol className="flex flex-col gap-5">
              {logs.length ? logs.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-medium leading-5 text-navy">{log.action}</p>
                    <p className="mt-1 text-micro leading-5 text-muted-foreground">{log.target} · {log.actor}</p>
                    <time className="text-micro text-muted-foreground" dateTime={log.date}>{new Date(log.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                  </div>
                </li>
              )) : <li className="text-xs text-muted-foreground">Activity will appear here.</li>}
            </ol>
            <Link to="/super-admin/logs" className="text-link mt-4 text-xs">View full audit log<ArrowRight className="size-3" /></Link>
          </Panel>
        </div>
      </div>
    </>
  )
}
