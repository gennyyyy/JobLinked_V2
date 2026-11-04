import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, BriefcaseBusiness, MapPin } from 'lucide-react'
import { listJobs } from '@/shared/services/jobs'
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from '@/shared/lib/savedJobs'
import { JobListSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import { CompanyMark, EmptyState, LinkButton, PageHeading, Panel } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

function salaryLabel(job) {
  if (!job.salaryMin) return 'Salary not disclosed'
  const format = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
  return `${format(job.salaryMin)}${job.salaryMax ? ` – ${format(job.salaryMax)}` : '+'}`
}

export default function SavedJobs() {
  const [savedIds, setSavedIds] = useState(() => getSavedJobIds())
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeSavedJobs(() => setSavedIds(getSavedJobIds()))
    listJobs({ pageSize: 500 })
      .then((result) => setJobs(result.jobs || []))
      .catch((err) => setError(err.message || 'Failed to load saved jobs'))
      .finally(() => setLoading(false))
    return unsubscribe
  }, [])

  const saved = savedIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter(Boolean)

  return (
    <>
      <PageHeading
        eyebrow="Your collection"
        title="Keep good opportunities close."
        description="Your saved vacancies, together in one place. Closed roles may no longer accept applications."
        action={<LinkButton href="/job-seeker/jobs" variant="outline">Browse all jobs</LinkButton>}
      />
      <Panel title="Saved opportunities" description={`${saved.length} saved ${saved.length === 1 ? 'opportunity' : 'opportunities'}`}>
        {loading ? (
          <JobListSkeleton count={2} />
        ) : error ? (
          <InlineError message={error} />
        ) : saved.length === 0 ? (
          <EmptyState
            title="No saved jobs yet."
            description="Save opportunities while browsing and they will appear here."
            href="/job-seeker/jobs"
            label="Browse all jobs"
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {saved.map((job) => (
              <li key={job.id}>
                <article className="surface p-5">
                  <div className="flex items-start gap-3">
                    <CompanyMark initials={String(job.employerName || 'Company').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-muted-foreground">{titleCase(job.employerName)}</p>
                      <span className="mt-1 block text-[10px] text-teal">Verified employer</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${job.title} from saved jobs`}
                      onClick={() => setSavedIds(toggleSavedJob(job.id))}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-primary hover:bg-muted"
                    >
                      <Bookmark className="size-4 fill-primary" />
                      Saved
                    </button>
                  </div>
                  <h2 className="mt-4 text-[17px] font-semibold leading-6 tracking-[-.025em]">
                    <Link to={`/job-seeker/jobs/${job.id}`} className="transition-colors hover:text-primary">{job.title}</Link>
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{job.barangay}</span>
                    <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{job.type}</span>
                  </div>
                  <p className="mt-4 text-[15px] font-semibold text-navy">{salaryLabel(job)}</p>
                  <Link to={`/job-seeker/jobs/${job.id}`} className="mt-4 inline-flex min-h-9 items-center text-[11px] font-medium text-primary">View job →</Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
