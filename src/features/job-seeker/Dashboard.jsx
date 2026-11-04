import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, MapPin, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import useAuth from '@/shared/hooks/useAuth'
import { listBySeeker } from '@/shared/services/applications'
import { listJobs } from '@/shared/services/jobs'
import { listNotifications } from '@/shared/services/notifications'
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from '@/shared/lib/savedJobs'
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

const salaryLabel = (job) => (job.salary_min
  ? `₱${Number(job.salary_min).toLocaleString()}${job.salary_max ? ` – ₱${Number(job.salary_max).toLocaleString()}` : ''}`
  : 'Salary negotiable')

const postedLabel = (value) => {
  if (!value) return 'Recently posted'
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86400000))
  return days === 0 ? 'Posted today' : `${days} day${days === 1 ? '' : 's'} ago`
}

function skillMatch(job, user) {
  const skills = (Array.isArray(user?.skills) ? user.skills : []).filter(Boolean)
  const haystack = `${job.title || ''} ${job.description || ''} ${job.requirements || ''} ${(job.tags || []).join(' ')}`.toLowerCase()
  const matched = skills.filter((skill) => haystack.includes(String(skill).toLowerCase()))
  const total = skills.length || matched.length
  const pct = total ? Math.round((matched.length / total) * 100) : 0
  return { matched, total, pct }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [recommended, setRecommended] = useState([])
  const [savedIds, setSavedIds] = useState(() => getSavedJobIds())
  const [savedCount, setSavedCount] = useState(() => getSavedJobIds().length)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => subscribeSavedJobs(() => {
    setSavedIds(getSavedJobIds())
    setSavedCount(getSavedJobIds().length)
  }), [])

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError('')
    Promise.all([
      listBySeeker(user.id),
      listJobs({ page: 1, pageSize: 50 }),
      listNotifications(user.id).catch(() => []),
    ])
      .then(([apps, { jobs }, alerts]) => {
        setApplications(apps)
        setNotices((alerts || []).filter((alert) => !alert.is_read).slice(0, 2))
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state must be set when effect runs
  useEffect(() => { load() }, [load])

  if (loading) return <PageSkeleton stats={4} panels={2} />

  const firstName = user?.first_name || String(user?.full_name || user?.name || 'there').split(' ')[0]

  if (error) return (
    <>
      <PageHeading
        eyebrow="Your next chapter"
        title="We couldn\u2019t load your overview."
        description="Please try again in a moment."
      />
      <InlineError message={error} onRetry={load} />
    </>
  )

  const interviews = applications.filter((app) => app.status === 'Interview').length
  const completion = profileCompletion(user)
  const recentApps = [...applications].sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at)).slice(0, 4)

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
          { label: 'Saved opportunities', value: savedCount, icon: Bookmark },
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
                      <CompanyMark initials={String(application.job?.employers?.company_name || 'J').charAt(0).toUpperCase()} />
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
              {recommended.length ? recommended.map((job) => {
                const match = skillMatch(job, user)
                const company = job.employers?.company_name || 'Verified employer'
                const saved = savedIds.includes(job.id)
                const tags = (Array.isArray(job.tags) ? job.tags : []).slice(0, 2)
                return (
                  <Card key={job.id} className="job-card h-full gap-5 [--card-spacing:--spacing(5)]">
                    <CardHeader>
                      <div className="mb-4 flex items-start gap-3">
                        <CompanyMark initials={String(company).charAt(0).toUpperCase()} />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="truncate text-[11px] font-medium text-muted-foreground">{titleCase(company)}</p>
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-teal"><Check className="size-3" />Verified employer</span>
                        </div>
                        <button
                          type="button"
                          aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
                          aria-pressed={saved}
                          onClick={() => setSavedIds(toggleSavedJob(job.id))}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        >
                          {saved ? <BookmarkCheck className="size-4 fill-primary text-primary" /> : <Bookmark className="size-4" />}
                        </button>
                      </div>
                      <CardTitle>
                        <Link to={`/job-seeker/jobs/${job.id}`} className="text-[17px] leading-6 tracking-[-.025em] transition-colors hover:text-primary">{job.title}</Link>
                      </CardTitle>
                      <CardDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{job.location || 'Santa Maria'}</span>
                        <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{job.employment_type || 'Full-time'}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                        {match.pct > 0 && <Badge variant="secondary" className="bg-teal-soft text-teal">{match.pct}% skills overlap</Badge>}
                      </div>
                      <p className="text-[15px] font-semibold text-navy">
                        {salaryLabel(job)}
                        {job.salary_min ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ month</span> : null}
                      </p>
                      <p className="text-[11px] leading-5 text-muted-foreground">
                        {match.matched.length} of {match.total} listed skills match: {match.matched.join(', ') || 'no exact matches yet'}.
                      </p>
                    </CardContent>
                    <CardFooter className="justify-between bg-white py-3">
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 className="size-3" />{postedLabel(job.created_at)}</span>
                      <Link to={`/job-seeker/jobs/${job.id}`} className="flex min-h-9 items-center gap-1 text-[11px] font-medium text-primary">View job<ArrowUpRight className="size-3" /></Link>
                    </CardFooter>
                  </Card>
                )
              }) : <EmptyState title="No recommendations yet." description="Add skills and preferences to see matches." href="/job-seeker/profile" />}
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
            {notices.length ? (
              <ul className="flex flex-col gap-4">
                {notices.map((notice) => (
                  <li key={notice.id}>
                    <p className="text-xs font-medium text-navy">{notice.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(notice.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-6 text-muted-foreground">You’re all caught up. We’ll show new updates here.</p>
            )}
            <Link to="/job-seeker/notifications" className="text-link mt-3 text-xs">Open notifications<ArrowRight className="size-3" /></Link>
          </Panel>
        </div>
      </div>
    </>
  )
}
