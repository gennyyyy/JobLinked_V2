import { useEffect, useMemo, useState } from 'react'
import useAuth from '@/shared/hooks/useAuth'
import { listJobs } from '@/shared/services/jobs'
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from '@/shared/lib/savedJobs'
import { PageHeading, Notice, EmptyState, SearchInput } from '@/shared/components/design'
import { TagInput, splitTags } from '@/shared/components/TagInput'
import JobCard from '@/shared/components/JobCard'
import PreferenceMatching from './PreferenceMatching'
import { JobListSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { isJobOpen, matchJob, preferenceScore } from '@/shared/utils/jobDisplay'

const PAGE_SIZE = 15
const jobHref = (id) => `/job-seeker/jobs/${id}`

// 1:1 port of the reference opportunities page, shared by Browse Jobs and
// Saved jobs (saved=true renders the collection variant).
export default function OpportunityList({ saved = false }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
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

  const records = useMemo(() => {
    const text = query.toLowerCase()
    const skillTerms = splitTags(skillFilter).map((skill) => skill.toLowerCase())
    return jobs
      .filter((job) => (saved ? savedIds.includes(job.id) : isJobOpen(job) && (!job.employers?.accreditation_status || job.employers.accreditation_status === 'approved')))
      .filter((job) => `${job.title} ${job.employers?.company_name || ''}`.toLowerCase().includes(text))
      // Same rule as the public board / API: any selected skill, case-insensitive
      // substring of title + description + requirements + tags.
      .filter((job) => {
        if (!skillTerms.length) return true
        const haystack = `${job.title || ''} ${job.description || ''} ${job.requirements || ''} ${(job.tags || []).join(' ')}`.toLowerCase()
        return skillTerms.some((term) => haystack.includes(term))
      })
      .sort((a, b) => (saved
        ? String(b.created_at).localeCompare(String(a.created_at))
        : (matchingPrompt ? preferenceScore(b, matchingPrompt) - preferenceScore(a, matchingPrompt) : 0)
          || matchJob(b, user).score - matchJob(a, user).score))
  }, [jobs, saved, savedIds, query, skillFilter, matchingPrompt, user])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = saved ? 1 : Math.min(page, pages)
  const visible = saved ? records : records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSave(id) {
    setSavedIds(toggleSavedJob(id))
  }

  return (
    <>
      <PageHeading
        eyebrow={saved ? 'Your collection' : 'Built around your skills'}
        title={saved ? 'Keep good opportunities close.' : 'Browse Jobs'}
        description={saved
          ? 'Your saved vacancies, together in one place. Closed roles may no longer accept applications.'
          : 'Explore local roles ranked by the skills you have added to your profile.'}
      />
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-lg">
          <SearchInput
            value={query}
            onChange={(value) => { setQuery(value); setPage(1) }}
            label={saved ? 'Search saved opportunities' : 'Search your recommendations'}
            placeholder={saved ? 'Search saved opportunities…' : 'Search your recommendations…'}
          />
        </div>
        {!saved && (
          <div className="min-w-0 sm:w-72">
            <label htmlFor="browse-jobs-skills" className="mb-2 block text-xs text-muted-foreground">Filter by skills</label>
            <TagInput
              id="browse-jobs-skills"
              value={skillFilter}
              onChange={(value) => { setSkillFilter(value); setPage(1) }}
              max={3}
              placeholder="Search for skills"
            />
          </div>
        )}
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
    </>
  )
}
