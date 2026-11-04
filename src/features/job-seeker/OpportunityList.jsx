import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import useAuth from '@/shared/hooks/useAuth'
import { listJobs } from '@/shared/services/jobs'
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from '@/shared/lib/savedJobs'
import { PageHeading, Notice, EmptyState, SearchInput, SelectField } from '@/shared/components/design'
import JobCard from '@/shared/components/JobCard'
import PreferenceMatching from './PreferenceMatching'
import { JobListSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import { categoryLabel, experienceLevel, isJobOpen, jobType, matchJob, preferenceScore } from '@/shared/utils/jobDisplay'

const PAGE_SIZE = 15
const jobHref = (id) => `/job-seeker/jobs/${id}`
const EMPTY_FILTERS = { barangay: '', category: '', type: '', salary: '', experience: '' }
const SALARY_OPTIONS = [
  { label: 'Below ₱15,000', value: '0-15000' },
  { label: '₱15,000 – ₱25,000', value: '15000-25000' },
  { label: '₱25,000 – ₱40,000', value: '25000-40000' },
  { label: '₱40,000 and above', value: '40000-10000000' },
]
const EXPERIENCE_OPTIONS = ['No experience', 'Entry level', '1–3 years', '3+ years']

// 1:1 port of the reference opportunities page, shared by Browse Jobs and
// Saved jobs (saved=true renders the collection variant).
export default function OpportunityList({ saved = false }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [matchingPrompt, setMatchingPrompt] = useState('')
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState([])
  const [savedIds, setSavedIds] = useState(() => getSavedJobIds())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => subscribeSavedJobs(() => setSavedIds(getSavedJobIds())), [])

  useEffect(() => {
    let cancelled = false
    listJobs({ pageSize: 200, order: 'created_at.desc' })
      .then((result) => { if (!cancelled) setJobs(Array.isArray(result?.jobs) ? result.jobs : []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load jobs') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const categoryOptions = useMemo(
    () => [...new Set(jobs.map(categoryLabel).filter(Boolean))].sort(),
    [jobs],
  )
  const typeOptions = useMemo(
    () => [...new Set(jobs.map(jobType).filter(Boolean))].sort(),
    [jobs],
  )

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(1)
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setQuery('')
    setPage(1)
  }

  const records = useMemo(() => {
    const text = query.toLowerCase()
    const [salaryLow, salaryHigh] = filters.salary ? filters.salary.split('-').map(Number) : [null, null]
    return jobs
      .filter((job) => (saved ? savedIds.includes(job.id) : isJobOpen(job) && (!job.employers?.accreditation_status || job.employers.accreditation_status === 'approved')))
      .filter((job) => `${job.title} ${job.employers?.company_name || ''}`.toLowerCase().includes(text))
      .filter((job) => (!filters.barangay || job.location === filters.barangay))
      .filter((job) => (!filters.category || categoryLabel(job) === filters.category))
      .filter((job) => (!filters.type || jobType(job) === filters.type))
      .filter((job) => (!filters.experience || experienceLevel(job) === filters.experience))
      .filter((job) => {
        if (salaryLow === null) return true
        const min = Number(job.salary_min)
        if (!Number.isFinite(min)) return false
        const max = Number.isFinite(Number(job.salary_max)) ? Number(job.salary_max) : min
        return max >= salaryLow && min <= salaryHigh
      })
      .sort((a, b) => (saved
        ? String(b.created_at).localeCompare(String(a.created_at))
        : (matchingPrompt ? preferenceScore(b, matchingPrompt) - preferenceScore(a, matchingPrompt) : 0)
          || matchJob(b, user).score - matchJob(a, user).score))
  }, [jobs, saved, savedIds, query, filters, matchingPrompt, user])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = saved ? 1 : Math.min(page, pages)
  const visible = saved ? records : records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSave(id) {
    setSavedIds(toggleSavedJob(id))
  }

  const filterFields = (prefix) => (
    <div className="flex flex-col gap-5">
      <SelectField
        id={`${prefix}-barangay`}
        label="Barangay"
        placeholder="All barangays"
        options={SANTA_MARIA_BARANGAYS}
        value={filters.barangay}
        onChange={(event) => updateFilter('barangay', event.target.value)}
      />
      <SelectField
        id={`${prefix}-category`}
        label="Job category"
        placeholder="All categories"
        options={categoryOptions}
        value={filters.category}
        onChange={(event) => updateFilter('category', event.target.value)}
      />
      <SelectField
        id={`${prefix}-type`}
        label="Employment type"
        placeholder="All types"
        options={typeOptions}
        value={filters.type}
        onChange={(event) => updateFilter('type', event.target.value)}
      />
      <SelectField
        id={`${prefix}-salary`}
        label="Monthly salary"
        placeholder="Any salary"
        options={SALARY_OPTIONS}
        value={filters.salary}
        onChange={(event) => updateFilter('salary', event.target.value)}
      />
      <SelectField
        id={`${prefix}-experience`}
        label="Experience level"
        placeholder="Any experience"
        options={EXPERIENCE_OPTIONS}
        value={filters.experience}
        onChange={(event) => updateFilter('experience', event.target.value)}
      />
      <button type="button" onClick={resetFilters} className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-primary">
        Reset all filters
      </button>
    </div>
  )

  return (
    <>
      <PageHeading
        eyebrow={saved ? 'Your collection' : 'Built around your skills'}
        title={saved ? 'Keep good opportunities close.' : 'Browse Jobs'}
        description={saved
          ? 'Your saved vacancies, together in one place. Closed roles may no longer accept applications.'
          : 'Explore local roles ranked by the skills you have added to your profile.'}
      />
      <div className="flex flex-col gap-7 lg:flex-row">
        {!saved && (
          <aside className="surface h-fit w-full shrink-0 lg:w-[235px]">
            <div className="mb-6 flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Narrow your search</h2>
            </div>
            {filterFields('desktop')}
          </aside>
        )}
        <div className="min-w-0 flex-1">
          {!saved && (
            <PreferenceMatching
              prompt={matchingPrompt}
              onSubmit={(prompt) => { setMatchingPrompt(prompt); setPage(1) }}
            />
          )}
          {!saved && (
            <div className="mb-6">
              <Notice title="A match you can understand">
                Skills overlap is the number of your exact, case-insensitive skill matches divided by the skills listed in the vacancy. It is not AI, a hiring score, or a guarantee. Add skills in My Profile to update your recommendations.
              </Notice>
            </div>
          )}
          <div className="mb-5 max-w-lg">
            <SearchInput
              value={query}
              onChange={(value) => { setQuery(value); setPage(1) }}
              label={saved ? 'Search saved opportunities' : 'Search your recommendations'}
              placeholder={saved ? 'Search saved opportunities…' : 'Search your recommendations…'}
            />
          </div>
          <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
            {records.length} {saved ? 'saved opportunities' : 'matching vacancies'}
          </p>
          {loading ? (
            <JobListSkeleton count={4} />
          ) : error ? (
            <InlineError message={error} />
          ) : records.length ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  href={jobHref(job.id)}
                  showMatch={!saved}
                  match={matchJob(job, user)}
                  saved={savedIds.includes(job.id)}
                  canSave={user?.role === 'job-seeker'}
                  onToggleSave={toggleSave}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={saved ? 'Make room for your next chapter.' : 'No matching opportunities in this view.'}
              description={saved
                ? 'Tap the bookmark on a vacancy to save it here, or clear your search.'
                : 'Try another search or explore all local vacancies.'}
              href="/jobs"
            />
          )}
          {!saved && records.length > 0 && (
            <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
          )}
        </div>
      </div>
    </>
  )
}
