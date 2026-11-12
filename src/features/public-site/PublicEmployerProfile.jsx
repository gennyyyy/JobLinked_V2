import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, MapPin } from 'lucide-react'
import { getEmployer, listEmployerJobs } from '@/shared/services/jobs'
import { logoUrl } from '@/shared/services/images'
import { PageSkeleton } from '@/shared/components/Skeletons'
import PublicShell from '@/shared/components/PublicShell'
import { CompanyMark, EmptyState, Panel, VerifiedBadge } from '@/shared/components/design'
import JobCard from '@/shared/components/JobCard'
import { titleCase } from '@/shared/utils/titleCase'

function companyInitials(name) {
  return String(name || 'Company')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function PublicEmployerProfile() {
  const { employerId } = useParams()
  const [employer, setEmployer] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) { setLoading(true); setError('') } })
    Promise.all([getEmployer(employerId), listEmployerJobs(employerId)])
      .then(([emp, jobsRes]) => {
        if (!active) return
        setEmployer(emp)
        const list = Array.isArray(jobsRes) ? jobsRes : (jobsRes?.data || jobsRes?.jobs || [])
        setJobs(list)
      })
      .catch((err) => {
        if (!active) return
        setError(err?.message || 'Failed to load employer')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [employerId])

  if (loading) return <PageSkeleton stats={0} panels={2} />
  if (error) return <div className="py-8 text-center text-sm text-destructive">{error}</div>
  if (!employer) return <div className="py-8 text-center text-sm text-muted-foreground">Employer not found.</div>

  const company = titleCase(employer.company_name) || 'Verified employer'
  const industry = employer.industry ? titleCase(employer.industry) : ''
  const location = [employer.barangay_district, employer.city_municipality, employer.province_state]
    .filter(Boolean)
    .map((part) => titleCase(part))
    .join(', ')
  const companyLogo = !logoFailed && employer ? logoUrl(employer.id, employer.logo_updated_at) : null

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
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt={`${company} logo`}
                    data-testid="company-logo-image"
                    loading="lazy"
                    decoding="async"
                    className="size-16 rounded-2xl border object-cover"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <CompanyMark initials={companyInitials(company)} large />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <VerifiedBadge />
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{company}</h1>
                  {industry && <p className="mt-2 text-sm text-muted-foreground">{industry}</p>}
                  {location && (
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{location}</span>
                    </div>
                  )}
                  {employer.website && (
                    <a
                      href={employer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Globe className="size-3.5" />
                      {employer.website}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {employer.description && (
            <div className="mt-6">
              <Panel title="About the company">
                <p className="prose-copy whitespace-pre-line">{employer.description}</p>
              </Panel>
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold">Open positions</h2>
            {jobs.length === 0 ? (
              <EmptyState title="No open positions" description="This employer has no published openings right now." href="/jobs" label="Browse jobs" />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} href={`/jobs/${job.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  )
}