import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarDays, CheckCircle2, ClipboardList, UserRound } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import useAuth from '@/shared/hooks/useAuth'
import { listBySeeker } from '@/shared/services/applications'
import { listJobs } from '@/shared/services/jobs'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import { CompanyMark, EmptyState, LinkButton, PageHeading, Panel, StatCards, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

function splitPref(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',')
  return list.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
}

function scoreJob(job, user) {
  const skills = user?.skills || []
  const jobText = `${job.title || ''} ${job.description || ''} ${job.requirements || ''}`.toLowerCase()
  const skillHits = skills.filter((s) => jobText.includes(String(s).toLowerCase())).length
  let score = skillHits
  const title = (job.title || '').toLowerCase()
  const location = (job.location || '').toLowerCase()
  if (splitPref(user?.preferred_position).some((tag) => title.includes(tag))) score += 2
  if (splitPref(user?.preferred_location).some((tag) => location.includes(tag))) score += 1
  if (user?.barangay_district && location.includes(user.barangay_district.toLowerCase())) score += 1
  return score
}

function profileCompletion(user) {
  const checks = [
    user?.first_name, user?.last_name, user?.phone, user?.barangay_district, user?.birthdate,
    user?.employment_status, user?.preferred_position, user?.preferred_location,
    user?.skills?.length, user?.street_address || user?.subdivision_building,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export default function Dashboard() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [recommended, setRecommended] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([listBySeeker(user.id), listJobs({ page: 1, pageSize: 50 })])
      .then(([apps, { jobs }]) => {
        setApplications(apps)
        const appliedJobIds = new Set(apps.map((a) => a.job_id))
        setRecommended(
          jobs
            .filter((job) => !appliedJobIds.has(job.id))
            .map((job) => ({ ...job, score: scoreJob(job, user) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2),
        )
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <PageSkeleton stats={4} panels={2} />
  if (error) return <InlineError message={error} />

  const interviews = applications.filter((app) => app.status === 'Interview Scheduled').length
  const completion = profileCompletion(user)
  const recentApps = [...applications].sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at)).slice(0, 4)
  const firstName = user?.first_name || String(user?.full_name || user?.name || 'there').split(' ')[0]

  return (
    <>
      <PageHeading
        eyebrow="Your next chapter"
        title={`Good to see you, ${firstName}.`}
        description="A little progress today can open a new door tomorrow. Let’s find your next local opportunity."
        action={<LinkButton href="/job-seeker/jobs"><BriefcaseBusiness data-icon="inline-start" />Explore jobs</LinkButton>}
      />
      <StatCards
        stats={[
          { label: 'Applications sent', value: applications.length, icon: ClipboardList },
          { label: 'Saved opportunities', value: 0, icon: Bookmark },
          { label: 'Upcoming interviews', value: interviews, icon: CalendarDays, tone: 'teal' },
          { label: 'Profile complete', value: `${completion}%`, icon: UserRound, note: 'Your profile, at a glance', tone: 'teal' },
        ]}
      />
      <div className="mb-6 flex flex-col justify-between gap-5 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[.14em] text-white/65">Opportunities close to home</p>
          <h2 className="text-xl font-semibold tracking-tight text-white">Your skills belong somewhere great.</h2>
          <p className="mt-2 max-w-lg text-xs leading-6 text-white/70">Explore verified employers across Santa Maria’s 24 barangays. Your next connection could be just around the corner.</p>
        </div>
        <LinkButton href="/job-seeker/jobs" variant="secondary">See my matches<ArrowRight data-icon="inline-end" /></LinkButton>
      </div>
      <div className="portal-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Your recent applications"
            description="Every next step, in one place."
            action={<Link to="/job-seeker/applications" className="text-link text-[11px]">View all<ArrowRight className="size-3" /></Link>}
          >
            {recentApps.length ? (
              <ul className="flex flex-col divide-y">
                {recentApps.map((application) => (
                  <li key={application.id}>
                    <Link to="/job-seeker/applications" className="flex min-h-24 flex-wrap items-center gap-3 py-3">
                      <CompanyMark initials={String(application.job?.employers?.company_name || 'J').slice(0, 2).toUpperCase()} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold leading-5">{application.job?.title || 'Unavailable vacancy'}</h3>
                        <p className="mt-1 text-[10px] text-muted-foreground">{titleCase(application.job?.employers?.company_name)} · {new Date(application.applied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <StatusBadge status={application.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Your first opportunity is waiting." description="Explore jobs, choose a role that fits, and submit an application." href="/job-seeker/jobs" />
            )}
          </Panel>
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Picked for your skills</h2>
              <Link className="text-link text-[11px]" to="/job-seeker/jobs">All recommendations<ArrowRight className="size-3" /></Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.length ? recommended.map((job) => (
                <Link key={job.id} to={`/job-seeker/jobs/${job.id}`} className="surface group flex flex-col p-5 transition-colors hover:border-primary/30">
                  <span className="text-[10px] font-medium uppercase tracking-[.14em] text-muted-foreground">{job.location} · {job.employment_type}</span>
                  <h3 className="mt-2 text-sm font-semibold leading-5 group-hover:text-primary">{job.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{titleCase(job.employers?.company_name)}</p>
                  <span className="mt-4 text-xs font-medium text-primary">View opportunity →</span>
                </Link>
              )) : <EmptyState title="No recommendations yet." description="Add skills and preferences to see matches." href="/job-seeker/profile" />}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Make a great first impression" description="A complete profile helps you apply with confidence.">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-semibold text-teal">{completion}%</span>
            </div>
            <Progress value={completion} aria-label={`Profile ${completion}% complete`} />
            <ul className="mt-5 flex flex-col gap-3 text-xs text-muted-foreground">
              {[
                { label: 'Contact and community', done: !!user?.phone && !!user?.barangay_district },
                { label: 'Education and skills', done: !!user?.skills?.length },
                { label: 'Preferred role and location', done: !!user?.preferred_position && !!user?.preferred_location },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <CheckCircle2 className={item.done ? 'size-4 text-teal' : 'size-4 text-muted-foreground'} />
                  {item.label}
                </li>
              ))}
            </ul>
            <Link to="/job-seeker/profile" className="text-link mt-4 text-xs">{completion === 100 ? 'Review my profile' : 'Complete my profile'}<ArrowRight className="size-3" /></Link>
          </Panel>
          <Panel title="A little heads-up" description="Application updates and announcements appear here.">
            <p className="text-xs leading-6 text-muted-foreground">You’re all caught up. We’ll show new updates here.</p>
            <Link to="/job-seeker/notifications" className="text-link mt-3 text-xs">Open notifications<ArrowRight className="size-3" /></Link>
          </Panel>
        </div>
      </div>
    </>
  )
}
