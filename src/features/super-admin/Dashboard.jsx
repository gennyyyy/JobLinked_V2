import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Building2, ChartNoAxesCombined, ClipboardCheck, Handshake, ShieldCheck, Users } from 'lucide-react'
import { getStats, listAllAccreditations, listAllApplications, listAuditLogs } from '@/shared/services/admin'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { InlineError } from '@/shared/components/dashboard'
import { EmploymentActivityChart } from '@/shared/components/EmploymentCharts'
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
        setAccreditations((accs.data || []).slice(0, 5))
        setApplications(applicationRows.data || [])
        setLogs(Array.isArray(audit) ? audit.slice(0, 5) : (audit?.data || []).slice(0, 5))
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />
  if (!stats) return null

  const firstName = user?.first_name || String(user?.full_name || user?.name || 'reviewer').split(' ')[0]

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
        eyebrow="Connect people. Strengthen community."
        title="A clearer picture of local opportunity."
        description={`Welcome, ${firstName}. Here’s your Santa Maria employment workspace at a glance.`}
        action={<LinkButton href="/super-admin/reports" variant="outline"><ChartNoAxesCombined data-icon="inline-start" />View reports</LinkButton>}
      />
      <StatCards
        stats={[
          { label: 'Registered job seekers', value: stats.seekers ?? 0, icon: Users },
          { label: 'Local employers', value: stats.employers ?? 0, icon: Building2 },
          { label: 'Pending accreditations', value: stats.pendingAccreditations ?? 0, icon: ShieldCheck, note: 'submissions awaiting review', tone: 'teal' },
          { label: 'Active vacancies', value: stats.approvedJobs ?? stats.jobs ?? 0, icon: BriefcaseBusiness, tone: 'teal' },
        ]}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'applications', value: stats.applications ?? 0, icon: ClipboardCheck },
          { label: 'Recorded referrals', value: applications.filter((application) => application.referred_by).length, icon: Handshake },
          ...(stats.placedApplicants !== undefined ? [{ label: 'placements', value: stats.placedApplicants, icon: Users }] : []),
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4">
            <span className="teal-icon"><Icon className="size-5" /></span>
            <div>
              <p className="text-xl font-semibold text-navy">{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
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
            action={<Link className="text-link text-[11px]" to="/super-admin/accreditation">Open queue<ArrowRight className="size-3" /></Link>}
          >
            {accreditations.length ? (
              <ul className="flex flex-col divide-y">
                {accreditations.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                    <CompanyMark initials={String(item.employers?.company_name || 'E').slice(0, 2).toUpperCase()} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-navy">{titleCase(item.employers?.company_name)}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Brgy. {item.employers?.barangay_district} · Submitted {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No employer applications submitted yet." description="New accreditation requests will appear here." />
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/65">One municipality. Many possibilities.</p>
            <h2 className="mt-4 text-xl font-semibold text-white">Every connection matters.</h2>
            <p className="mt-3 text-xs leading-6 text-white/70">Explore opportunities across Santa Maria’s 24 barangays. All numbers represent provided records, not actual municipal statistics.</p>
            <LinkButton href="/super-admin/reports" variant="secondary" className="mt-5">Explore barangay insights<ArrowRight data-icon="inline-end" /></LinkButton>
          </div>
          <Panel title="Recent workspace activity" description="Changes across all three roles.">
            <ol className="flex flex-col gap-5">
              {logs.length ? logs.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-medium leading-5 text-navy">{log.action}</p>
                    <p className="mt-1 text-[10px] leading-5 text-muted-foreground">{log.target} · {log.actor}</p>
                    <time className="text-[10px] text-muted-foreground" dateTime={log.date}>{new Date(log.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</time>
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
