import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Banknote, BriefcaseBusiness, Building2, CalendarDays, Layers, MapPin, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getJob } from '@/shared/services/jobs'
import { PageSkeleton } from '@/shared/components/Skeletons'
import PublicShell from '@/shared/components/PublicShell'
import { CompanyMark, LinkButton, Panel, VerifiedBadge } from '@/shared/components/design'
import { employerLogoUrl } from '@/shared/services/images'
import { titleCase } from '@/shared/utils/titleCase'

function money(value) {
  if (!value) return 'Negotiable'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(value))
}

function companyInitials(name) {
  return String(name || 'Company')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function PublicJobDetail() {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true;
    getJob(jobId)
      .then((job) => {
        if (!active) return;
        setJob(job);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load job');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [jobId]);

  if (loading) return <PageSkeleton stats={0} panels={2} />
  if (error) return <div className="py-8 text-center text-sm text-destructive">{error}</div>
  if (!job) return <Navigate to="/jobs" replace />

  const requirements = job.requirements ? job.requirements.split('\n').filter(Boolean) : []
  const benefits = job.benefits ? job.benefits.split('\n').filter(Boolean) : []
  const skills = Array.isArray(job.skills) ? job.skills.filter(Boolean) : []
  const highlights = Array.isArray(job.tags) ? job.tags.filter(Boolean) : []
  const company = titleCase(job.employers?.company_name) || 'Verified employer'

  return (
    <PublicShell>
      <div className="bg-muted/60">
        <div className="page-container py-8">
          <Link to="/jobs" className="text-link text-xs">
            <ArrowLeft className="size-3.5" />
            Back to opportunities
          </Link>

          <div className="surface mt-5">
            <div className="flex flex-col justify-between gap-5 sm:flex-row">
              <div className="flex gap-5">
                <CompanyMark initials={companyInitials(company)} src={employerLogoUrl(job.employers)} large />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <VerifiedBadge />
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{titleCase(job.title)}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {job.employers?.id ? (
                      <Link to={`/employers/${job.employers.id}`} className="hover:text-primary hover:underline">{company}</Link>
                    ) : (
                      company
                    )}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{titleCase(job.location) || 'Santa Maria'}, Santa Maria</span>
                    <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" />{job.employment_type || 'Full-time'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_335px]">
            <div className="flex flex-col gap-6">
              <Panel title="A little about this opportunity">
                <p className="prose-copy whitespace-pre-line">{job.description || 'No description provided for this opening.'}</p>
                {requirements.length > 0 && (
                  <section className="mt-7">
                    <h2 className="mb-3 text-sm font-semibold">What you’ll bring</h2>
                    <ul className="flex flex-col gap-2.5">
                      {requirements.map((req) => (
                        <li key={req} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {benefits.length > 0 && (
                  <section className="mt-7">
                    <h2 className="mb-3 text-sm font-semibold">What’s in it for you</h2>
                    <ul className="flex flex-col gap-2.5">
                      {benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {skills.length > 0 && (
                  <section className="mt-7" aria-labelledby="public-job-skills">
                    <h2 id="public-job-skills" className="mb-3 text-sm font-semibold">Skills required</h2>
                    <ul className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <li key={skill}>
                          <Badge variant="secondary">{skill}</Badge>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {highlights.length > 0 && (
                  <section className="mt-7" aria-labelledby="public-job-highlights">
                    <h2 id="public-job-highlights" className="mb-3 text-sm font-semibold">Job highlights</h2>
                    <ul className="flex flex-wrap gap-2">
                      {highlights.map((tag) => (
                        <li key={tag}>
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">{tag}</Badge>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </Panel>
            </div>

            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle>At a glance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <Banknote className="mt-0.5 size-4 text-teal" />
                  <div>
                    <p className="text-micro font-medium uppercase tracking-[.14em] text-muted-foreground">Compensation</p>
                    <p className="mt-1 text-sm font-medium text-navy">{money(job.salary_min)}{job.salary_max ? ` – ${money(job.salary_max)}` : job.salary_min ? '+' : ''}</p>
                  </div>
                </div>
                {job.field && (
                  <div className="flex items-start gap-3">
                    <Layers className="mt-0.5 size-4 text-teal" />
                    <div>
                      <p className="text-micro font-medium uppercase tracking-[.14em] text-muted-foreground">Field</p>
                      <p className="mt-1 text-sm font-medium text-navy">{job.field}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 text-teal" />
                  <div>
                    <p className="text-micro font-medium uppercase tracking-[.14em] text-muted-foreground">Work arrangement</p>
                    <p className="mt-1 text-sm font-medium text-navy">{job.work_arrangement || 'On-site'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-4 text-teal" />
                  <div>
                    <p className="text-micro font-medium uppercase tracking-[.14em] text-muted-foreground">Vacancies</p>
                    <p className="mt-1 text-sm font-medium text-navy">{job.vacancies ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-teal" />
                  <div>
                    <p className="text-micro font-medium uppercase tracking-[.14em] text-muted-foreground">Application deadline</p>
                    <p className="mt-1 text-sm font-medium text-navy">{job.deadline ? new Date(job.deadline).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-xs font-medium text-navy">Interested in this position?</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Apply online through your PESO Job Seeker account.</p>
                  <LinkButton href="/login" className="mt-4 w-full">Log in to Apply</LinkButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
